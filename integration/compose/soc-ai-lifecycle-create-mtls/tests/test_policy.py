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
import re
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
_PURE_SOURCE_FILES = ("__init__.py", "evidence.py", "policy.py", "procedure.py")
_RUNTIME_SOURCE_FILES = ("client.py", "harness.py", "pki.py", "server.py", "store.py")
_EXPECTED_SOURCE_FILES = tuple(sorted(_PURE_SOURCE_FILES + _RUNTIME_SOURCE_FILES))
_PINNED_B1_WHEEL_SHA256 = (
    "d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c"
)
_RUNTIME_IMPORT_RISK_CALLS = frozenset(
    {
        "Popen",
        "bind",
        "connect",
        "create_connection",
        "create_ephemeral_pki",
        "listen",
        "open",
        "run",
        "serve",
        "socket",
        "start",
    }
)

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


def test_source_inventory_covers_pure_and_runtime_modules_recursively() -> None:
    assert _SOURCE_FILES
    assert _SOURCE_FILES == _EXPECTED_SOURCE_FILES
    assert _SOURCE_FILES == tuple(
        sorted(
            path.relative_to(_SRC_ROOT).as_posix() for path in _SRC_ROOT.rglob("*.py")
        )
    )


def test_runtime_modules_have_no_import_time_process_io_or_network_calls() -> None:
    for filename in _RUNTIME_SOURCE_FILES:
        tree = _parse_source(filename)
        import_time_nodes = [
            node
            for statement in tree.body
            if not isinstance(
                statement, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
            )
            for node in ast.walk(statement)
        ]
        risky = {
            node.func.attr if isinstance(node.func, ast.Attribute) else node.func.id
            for node in import_time_nodes
            if isinstance(node, ast.Call)
            and isinstance(node.func, (ast.Attribute, ast.Name))
            and (
                node.func.attr if isinstance(node.func, ast.Attribute) else node.func.id
            )
            in _RUNTIME_IMPORT_RISK_CALLS
        }
        assert not risky, f"{filename} has import-time runtime calls: {sorted(risky)}"


@pytest.mark.parametrize("source_file", _PURE_SOURCE_FILES)
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


@pytest.mark.parametrize("source_file", _PURE_SOURCE_FILES)
def test_source_declares_no_runtime_execution_call(source_file: str) -> None:
    called = _called_names(_parse_source(source_file))
    assert called.isdisjoint(_FORBIDDEN_CALL_NAMES), sorted(
        called & _FORBIDDEN_CALL_NAMES
    )


@pytest.mark.parametrize("source_file", _PURE_SOURCE_FILES)
def test_source_text_excludes_dependency_and_runtime_markers(source_file: str) -> None:
    lowered = _read_source(source_file).lower()
    hits = [marker for marker in _FORBIDDEN_SOURCE_TEXT if marker in lowered]
    assert hits == []


@pytest.mark.parametrize("source_file", _PURE_SOURCE_FILES)
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
        delegates_to=(
            "ssl.SSLContext.load_cert_chain",
            "ssl.SSLContext.load_verify_locations",
        ),
        internal_patched=True,
    )
    assert policy.validate_ssl_context_builder(reference) is reference


def test_pinned_b1_builder_may_delegate_only_to_the_exact_patched_base() -> None:
    assert getattr(policy, "PINNED_B1_WHEEL_SHA256", None) == _PINNED_B1_WHEEL_SHA256
    reference = policy.SslContextBuilderReference(
        symbol=policy.INTERNAL_PATCHED_SSL_CONTEXT_BUILDER,
        delegates_to=(policy.ANYCORN_BASE_SSL_CONTEXT_BUILDER,),
        internal_patched=True,
        artifact_sha256=_PINNED_B1_WHEEL_SHA256,
    )
    assert policy.validate_ssl_context_builder(reference) is reference


def test_patched_base_delegate_rejects_a_wrong_artifact_digest() -> None:
    reference = policy.SslContextBuilderReference(
        symbol=policy.INTERNAL_PATCHED_SSL_CONTEXT_BUILDER,
        delegates_to=(policy.ANYCORN_BASE_SSL_CONTEXT_BUILDER,),
        internal_patched=True,
        artifact_sha256="0" * 64,
    )
    with pytest.raises(policy.PolicyViolation) as caught:
        policy.validate_ssl_context_builder(reference)
    assert caught.value.reason == "builder_artifact_digest_mismatch"


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

    exact_status = "Status: `D2-P0 PREFLIGHT AUTHORED — RUNTIME NOT RUN`."
    for text in (harness_readme, compose_readme):
        assert text.splitlines()[2] == exact_status
        assert "D1 ARTIFACT COMPLETE — RUNTIME NOT RUN" in text
        assert "UAT-MTLS-D2" in text and "HOLD" in text
        assert "DEMO_READY_LOCAL" in text and "NO-GO" in text
    assert (
        "No Anycorn or product package is imported, installed, resolved, built or downloaded"
        not in harness_readme
    )
    assert "dependency-neutral preparation only" not in compose_readme


def test_d2_p0_discloses_the_unsatisfied_phase_a_coverage_gate() -> None:
    harness_readme = (_HARNESS_ROOT / "README.md").read_text(encoding="utf-8")
    decision = (
        _REPO_ROOT / "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md"
    ).read_text(encoding="utf-8")

    for text in (harness_readme, decision):
        normalized = " ".join(text.split())
        assert "D2-P0 does not satisfy the section 7.3 coverage gate" in normalized
        assert "at least 80% line and branch coverage" in normalized
        assert "100% coverage of the critical paths" in normalized
        assert "separate bounded coverage-tooling action" in normalized

    assert (
        "test_lifecycle_runtime.py::"
        "test_missing_pinned_trust_factory_is_wrapped_as_authorization_failure"
        in harness_readme
    )


def test_d2_coverage_tooling_proposal_is_exact_and_grants_no_runtime() -> None:
    harness_readme = (_HARNESS_ROOT / "README.md").read_text(encoding="utf-8")
    decision = (
        _REPO_ROOT / "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md"
    ).read_text(encoding="utf-8")
    normalized = " ".join(decision.split())
    normalized_readme = " ".join(harness_readme.split())

    assert "Gate UAT-MTLS-D2-COV-P0 — isolated coverage-tooling proposal" in decision
    assert (
        "EXECUTED — TOOLING VERIFIED — BASELINE COVERAGE FAIL — "
        "AUTHORIZATION CONSUMED — RUNTIME HOLD"
    ) in decision
    assert "coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl" in decision
    assert (
        "b868acc62aa5de3be7a9d05c2333bf8359ca987e43f9cb30ff8fbda6a024ab73" in decision
    )
    assert "--no-index --no-deps --target" not in normalized
    assert "<PINNED_PYTHON> -m zipfile -e" in normalized
    for forbidden_installer in ("pip install", "ensurepip", "uv pip"):
        assert forbidden_installer not in normalized
    assert "221943" in decision
    assert "files.pythonhosted.org/packages/06/d1/" in decision
    assert (
        "a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623" in decision
    )
    assert "mode-`0700`" in decision
    assert "cybrik-uat-d2-coverage-[a-z0-9]" in decision
    assert "cybrik-uat-d2-coverage-evidence-" in decision
    assert "PINNED_PYTHON_REALPATH=" in decision
    assert "its single link target must be `python3.12`" in normalized
    assert "https://api.osv.dev/v1/query" in decision
    assert "must not edit `pyproject.toml`, `uv.lock`" in normalized
    assert "--source=<SUITE_ROOT>/integration/compose/" in decision
    runtime_nodeid = (
        "tests/test_lifecycle_runtime.py::"
        "test_authorized_runtime_attempt_executes_the_red_green_sequence"
    )
    assert f"--deselect={runtime_nodeid}" in decision
    assert f"--deselect=<SUITE_ROOT>/integration/compose/soc-ai-lifecycle-create-mtls/{runtime_nodeid}" not in decision
    assert "coverage report --rcfile=/dev/null" in normalized
    assert "coverage json --rcfile=/dev/null" in normalized
    assert "coverage run --rcfile=/dev/null --branch" in normalized
    assert "cd <SUITE_ROOT>" in decision
    assert decision.count("<PINNED_PYTHON> -m coverage ") == 3
    assert "at least 80% line coverage and at least 80% branch coverage" in normalized
    for critical in (
        "server.build_patched_ssl_context",
        "policy.parse_loopback_bind",
        "policy.validate_proposed_bind",
        "evidence.secret_reason",
        "evidence.validate_evidence",
        "harness._assert_ssl_context_evidence",
        "harness.teardown",
        "harness.verify_absent",
    ):
        assert critical in decision
    assert (
        "removes only the still identity-bound isolated tool root and preserves the evidence root"
        in normalized
    )
    assert "HOST_TEMP_ROOT=" in decision
    assert (
        "derive the canonical Darwin user temporary directory at execution"
        in normalized
    )
    assert "must equal the recorded `HOST_TEMP_ROOT`" in normalized
    assert (
        "equal the exact `COVERAGE_ROOT` and `COVERAGE_EVIDENCE_ROOT` values from the Founder"
        in normalized
    )
    assert "canonical Darwin host-temp derivation/pin" in normalized_readme
    assert "No successful install or measurement by itself opens Phase A" in normalized
    assert "UAT-MTLS-D2-COV-P0" in harness_readme
    assert "authorizes nothing until Founder approval is recorded" in normalized_readme


def test_d2_coverage_closure_recovery_is_one_shot_and_grants_no_runtime() -> None:
    harness_readme = (_HARNESS_ROOT / "README.md").read_text(encoding="utf-8")
    decision = (
        _REPO_ROOT / "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md"
    ).read_text(encoding="utf-8")
    authority = (
        _REPO_ROOT
        / "docs/operations/DELEGATED-GOVERNOR-D2-COVERAGE-CLOSURE-RECOVERY-2026-08-02.md"
    ).read_text(encoding="utf-8")
    normalized = " ".join((decision + "\n" + harness_readme + "\n" + authority).split())
    summary = json.loads(
        (_HARNESS_ROOT / "evidence/coverage-closure-recovery.json").read_text()
    )
    assert summary["schema_version"] == "1.3.0"

    def current_state(gate: str) -> str:
        match = re.search(
            rf"^### {re.escape(gate)}\n\nCurrent state: `([^`]+)`\.$",
            decision,
            re.MULTILINE,
        )
        assert match is not None
        return match.group(1)

    assert "Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R1" in decision
    assert current_state("Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R1") == (
        "EXECUTED — FAILED PRE-NETWORK — AUTHORIZATION CONSUMED — RUNTIME HOLD"
    )
    assert current_state("Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R2") == (
        "EXECUTED — FAILED AFTER WHEEL ACQUISITION — AUTHORIZATION CONSUMED — RUNTIME HOLD"
    )
    assert current_state("Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R3") == (
        "EXECUTED — FAILED AFTER WHEEL ACQUISITION — AUTHORIZATION CONSUMED — RUNTIME HOLD"
    )
    assert current_state("Gate UAT-MTLS-D2-CLOSURE-RECOVERY-R4") == (
        "EXECUTED — VERIFIED — AUTHORIZATION CONSUMED — COVERAGE CLOSURE READY — RUNTIME HOLD"
    )
    assert "recover_coverage_closure.py" in harness_readme
    assert "exactly the 56 filenames and SHA-256 values" in normalized
    assert (
        "6d6937112e7598ed13e21a96573c9e57c20dbb5df5d986670252391a40c5f919" in normalized
    )
    assert "R1 exact-action authority was consumed" in authority
    assert summary["r1"]["network_calls_started"] == 0
    assert summary["r1"]["rollback_status"] == "removed"
    assert summary["r2"]["execution_status"] == "failed"
    assert summary["r2"]["failure_reason"] == "venv_identity_mismatch"
    assert summary["r2"]["network_phase_status"] == (
        "wheel_acquisition_and_verification_completed"
    )
    assert summary["r2"]["rollback_status"] == "removed"
    assert summary["r2"]["retry_ceiling"] == 1
    assert summary["r3"]["execution_status"] == "failed"
    assert summary["r3"]["failure_reason"] == "venv_identity_mismatch"
    assert summary["r3"]["network_phase_status"] == (
        "wheel_acquisition_and_verification_completed"
    )
    assert summary["r3"]["rollback_status"] == "removed"
    assert summary["r3"]["retry_ceiling"] == 1
    assert summary["r3"]["expected_final_links"]["python"] == "python3.12"
    assert summary["r4"]["execution_status"] == "passed"
    assert summary["r4"]["status"] == "verified"
    assert summary["r4"]["closure_root_removed"] is False
    assert summary["r4"]["attempt_id"] == (
        "ab467ae45163e72dc1bdb22c50d0db8cb478eb87b123ca5efdd71269b590e2b6"
    )
    assert summary["r4"]["commit"] == ("3c20de6ff6b44ff8b2c8b6c33d13f2f76672adfb")
    assert summary["r4"]["tree"] == "dae9bb5621ecefe10f62c2164dd4e1565cfcb377"
    assert summary["r4"]["closure_sha256"] == (
        "6d6937112e7598ed13e21a96573c9e57c20dbb5df5d986670252391a40c5f919"
    )
    assert summary["r4"]["wheel_count"] == 56
    assert summary["r4"]["recovery_start_sha256"] == (
        "40f57b331949e1ffaa0db73d4903cf631ad6207fd57a7776ef0a2b4dbb24654e"
    )
    assert summary["r4"]["recovery_result_sha256"] == (
        "7d8b81036e48e4ffe0bd4ba94545f1aa2cd42d7dc82ba27e4eec68f6c6526b7f"
    )
    assert summary["r4"]["recovery_result_digest_file_sha256"] == (
        "900e66a512e8e1ea03ab30c45c8efc23f3216371c5afc620feccea9569ccb861"
    )
    assert summary["r4"]["installed_closure_file_sha256"] == (
        "6a83b0ea9693dc69cee4ccce517ac2d953e7df0c55ef8b82d99a877266f16538"
    )
    assert summary["r4"]["requirements_file_sha256"] == (
        "bf3fc708b271e245eacc1b0696f6892935fec9f45fda762fd5d041d0bdb7d07d"
    )
    assert summary["r4"]["wheel_manifest_sha256"] == (
        "bbec1a442f93066c684590be33560386e62e4257ec9d53a6b0119a92e6e2bc15"
    )
    assert summary["r4"]["started_at"] == "2026-08-02T03:26:51.384928+00:00"
    assert summary["r4"]["completed_at"] == "2026-08-02T03:27:07.084539+00:00"
    assert summary["r4"]["retry_ceiling"] == 1
    assert summary["r4"]["authorized_initial_links"]["python"].endswith(
        "cpython-3.12-macos-aarch64-none/bin/python3.12"
    )
    assert summary["r4"]["expected_final_links"]["python"] == "python3.12"
    assert (
        summary["r4"]["observed_final_links"] == summary["r4"]["expected_final_links"]
    )
    assert summary["r4"]["pinned_alias"]["sha256"] == (
        "a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623"
    )
    assert summary["r4"]["pinned_alias"]["alias_parent_literal_target"] == (
        "/Users/hoanglinh/.local/share/uv/python/cpython-3.12.13-macos-aarch64-none"
    )
    assert (
        summary["r4"]["pinned_alias"]["alias_parent_owner_requirement"]
        == "effective_uid"
    )
    assert summary["runtime_status"] == "HOLD"
    for excluded in (
        "does not install or extract Coverage.py",
        "does not install, select, execute or change Anycorn/B1",
        "does not create listeners, certificates, keys, containers or databases",
        "does not satisfy coverage, runtime admission, UAT, demo, POC, RC, GA or production gates",
    ):
        assert excluded in normalized


def test_d2_coverage_measurement_chain_is_terminal_and_runtime_stays_hold() -> None:
    harness_readme = (_HARNESS_ROOT / "README.md").read_text(encoding="utf-8")
    decision = (
        _REPO_ROOT / "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md"
    ).read_text(encoding="utf-8")
    authority = (
        _REPO_ROOT
        / "docs/operations/DELEGATED-GOVERNOR-D2-COVERAGE-MEASUREMENT-2026-08-02.md"
    ).read_text(encoding="utf-8")
    catalog = (_REPO_ROOT / "docs/operations/README.md").read_text(encoding="utf-8")
    claude = (_REPO_ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    summary = json.loads(
        (_HARNESS_ROOT / "evidence/coverage-measurement.json").read_text()
    )
    normalized = " ".join(
        (decision + "\n" + harness_readme + "\n" + authority + "\n" + catalog).split()
    )

    assert summary["schema_version"] == "1.0.0"
    assert summary["status"] == "verified"
    assert summary["gate"] == "UAT-MTLS-D2-COV-M2"
    assert summary["disposition"] == "COVERAGE_GATE_PASS_RUNTIME_HOLD"
    assert summary["suite_commit"] == "93c8b6efbd141ab3f37ff2f07f331153de5f314a"
    assert summary["suite_tree"] == "c67470e531dd3345744e3ef48bc11e0b3d3af218"

    p0 = summary["p0"]
    assert p0["tooling_status"] == "verified"
    assert p0["baseline_gate_status"] == "FAIL"
    assert p0["baseline_gate_reason"] == "package_line_coverage_below_80"
    assert p0["test_result"] == {"passed": 385, "skipped": 1, "failed": 0}
    assert p0["authorization_sha256"] == (
        "01af528bfd4e90d1c35d78b4089dd34571b7e10bf2eb3771e1848e30b580e2ae"
    )
    assert p0["coverage_json_sha256"] == (
        "e4694bf51e02091cfcaf3f0bb470792ed2149d9a9208df6e5ae48de650f2ec65"
    )
    assert p0["coverage_gate_sha256"] == (
        "937752ebffa9437e1e7139d0fb3755e6faf111fa608fb69ce0abf2e313f08128"
    )
    assert p0["coverage_json_mode_hardening"] == {
        "before": "0644",
        "after": "0600",
        "sha256_unchanged": True,
        "classification": "P3_NONBLOCKING_HYGIENE",
    }

    m1 = summary["m1"]
    assert m1["status"] == "FAIL"
    assert m1["failure_class"] == "runtime_test_was_not_deselected"
    assert m1["runtime_executed"] is False
    assert m1["network_calls"] == []
    assert m1["test_result"] == {"passed": 488, "skipped": 1, "failed": 0}
    assert m1["failure_sha256"] == (
        "989355888fb0ab53303f55bb0c7ae3ea41476548058dc921844cdda3495adaaa"
    )

    m2 = summary["m2"]
    assert m2["status"] == "PASS"
    assert m2["test_result"] == {
        "passed": 488,
        "deselected": 1,
        "skipped": 0,
        "failed": 0,
    }
    assert m2["line"] == {"covered": 1366, "total": 1568}
    assert m2["branch"] == {"covered": 439, "total": 514}
    assert len(m2["critical_symbols"]) == 8
    assert all(item["line_ratio"] == 1.0 for item in m2["critical_symbols"])
    assert all(
        item["branch_ratio"] == 1.0
        or item["branch_requirement"] == "not-applicable-no-static-branch"
        for item in m2["critical_symbols"]
    )
    assert m2["measurement_result_sha256"] == (
        "4a85daaeb793b2dbe573dab643ad3431024e8173159c408419837b2c743938f5"
    )
    assert m2["verifier_output_sha256"] == (
        "299a9ae6ca6a54f6cac573aa7657e03f3e879b4266658f083db4042ae59c73a4"
    )
    assert m2["network_calls"] == []
    assert m2["runtime_status"] == "HOLD"

    verifier_tests = summary["verifier_tests"]
    assert verifier_tests["passed"] == 31
    assert verifier_tests["failed"] == 0
    assert verifier_tests["junit_sha256"] == (
        "51ab9cdb2c1fddd34393735c4dd5ab9117b1fd4561cac0308e68d27a828907fe"
    )
    assert summary["historical_corrections"]["commit_93c8b6e_test_shape"] == (
        "488_passed_1_deselected_not_1_gated_skip"
    )
    assert summary["historical_corrections"]["p0_gate_hash_semantics"] == (
        "baseline_FAIL_integrity_anchor_not_M2_PASS_result"
    )
    assert summary["independent_reviews"] == {
        "codex": "GO_NO_P0_P3",
        "claude_opus": "GO_NO_P0_P2",
    }

    assert "Gate UAT-MTLS-D2-COV-M1 — failed command-shape measurement" in decision
    assert "Gate UAT-MTLS-D2-COV-M2 — terminal coverage measurement" in decision
    assert "COVERAGE GATE PASS — RUNTIME HOLD" in normalized
    assert "488 passed, 1 deselected" in normalized
    assert "31 passed" in normalized
    assert "Release dates remain unchanged" in normalized
    assert "D2 runtime, N1–N10" in normalized
    assert "DELEGATED-GOVERNOR-D2-COVERAGE-MEASUREMENT-2026-08-02.md" in claude


def test_d2_coverage_verifier_authoring_is_finite_and_grants_no_gate_credit() -> None:
    harness_readme = (_HARNESS_ROOT / "README.md").read_text(encoding="utf-8")
    decision = (
        _REPO_ROOT / "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md"
    ).read_text(encoding="utf-8")
    match = re.search(
        r"### Gate UAT-MTLS-D2-COV-P1 — stdlib verifier authoring"
        r"([\s\S]*?)(?=\n### Gate UAT-MTLS-D2 — real runtime execution)",
        decision,
    )
    assert match is not None
    section = match.group(1)
    scope = re.search(
        r"maximum authoring scope is exactly:\n\n((?:- `[^`]+`\n){6})\nNo other path",
        section,
    )
    assert scope is not None
    assert re.findall(r"^- `([^`]+)`$", scope.group(1), re.MULTILINE) == [
        "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md",
        "integration/compose/soc-ai-lifecycle-create-mtls/README.md",
        "integration/compose/soc-ai-lifecycle-create-mtls/scripts/verify_coverage_gate.py",
        "integration/compose/soc-ai-lifecycle-create-mtls/tests/test_coverage_gate.py",
        "integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py",
        "tools/contract-validation/tests/validate-transport.test.mjs",
    ]
    normalized = " ".join(section.split())
    assert (
        "AUTHORED — STATIC TESTS GREEN — COVERAGE NOT MEASURED — RUNTIME HOLD"
        in section
    )
    assert "pure stdlib and import-inert" in normalized
    assert "Coverage.py JSON format 3" in normalized
    assert "58c5f326cd785026b22123eb99385cad44d026aff64bd96dc0840a1baf26dea2" in section
    assert "8eb1f796e71ea4a57f4f9919dbbd3a2810182a7fb2cb1cffb861c861173ab754" in section
    assert "8294b5ef2ade283e167029b7ecf8cabdcbf9e1f527b98ee93c2d6bd1f980be0b" in section
    assert "from the first body statement through the last body statement" in normalized
    assert "no excluded line anywhere in the measured package" in normalized
    assert "not-applicable-no-static-branch" in section
    assert "critical source range may contain no excluded line" in normalized
    assert "`# pragma: no cover` or `# pragma: no branch`" in normalized
    assert "mode-`0600`" in section
    assert "PASS and FAIL" in section
    assert "does not install Coverage.py" in normalized
    assert "does not satisfy the section 7.3 coverage gate" in normalized
    assert "does not open Phase A" in normalized
    assert "verify_coverage_gate.py" in harness_readme
    assert "--result-json <COVERAGE_EVIDENCE_ROOT>/coverage-gate.json" in harness_readme


def test_d2_coverage_authorization_hardening_is_executable_but_grants_no_action() -> (
    None
):
    harness_readme = (_HARNESS_ROOT / "README.md").read_text(encoding="utf-8")
    decision = (
        _REPO_ROOT / "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md"
    ).read_text(encoding="utf-8")
    match = re.search(
        r"### Gate UAT-MTLS-D2-COV-P2 — executable authorization hardening"
        r"([\s\S]*?)(?=\n### Gate UAT-MTLS-D2 — real runtime execution)",
        decision,
    )
    assert match is not None
    section = match.group(1)
    scope = re.search(
        r"maximum hardening scope is exactly:\n\n((?:- `[^`]+`\n){6})\nNo other path",
        section,
    )
    assert scope is not None
    assert re.findall(r"^- `([^`]+)`$", scope.group(1), re.MULTILINE) == [
        "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md",
        "integration/compose/soc-ai-lifecycle-create-mtls/README.md",
        "integration/compose/soc-ai-lifecycle-create-mtls/scripts/validate_coverage_authorization.py",
        "integration/compose/soc-ai-lifecycle-create-mtls/tests/test_coverage_authorization.py",
        "integration/compose/soc-ai-lifecycle-create-mtls/tests/test_policy.py",
        "tools/contract-validation/tests/validate-transport.test.mjs",
    ]
    normalized = " ".join(section.split())
    for fact in (
        "PINNED_CLOSURE_SHA256",
        "D1_LOCK_SHA256",
        "D1_REQUIREMENTS_SHA256",
        "D1_LOCKED_WHEEL_COUNT",
        "CRYPTOGRAPHY_VERSION=50.0.0",
        "PYTEST_VERSION=9.1.1",
    ):
        assert fact in section
    assert "validate_coverage_authorization.py --authorization" in normalized
    assert "--check-only" in section and "--consume" in section
    assert "must not be under `/tmp`, `/private/tmp`" in normalized
    assert "does not install or restore the D1 closure" in normalized
    assert "D2 remains **HOLD**" in section
    assert "Release dates remain unchanged" in section
    assert "validate_coverage_authorization.py" in harness_readme
    assert "DEPENDENCY ACTION NOT RUN" in harness_readme


def test_dependency_neutral_readme_command_names_only_the_four_static_files() -> None:
    readme = (_HARNESS_ROOT / "README.md").read_text(encoding="utf-8")
    expected = (
        "test_policy.py",
        "test_evidence.py",
        "test_procedure.py",
        "test_case_inventory.py",
    )
    for filename in expected:
        assert (
            f"integration/compose/soc-ai-lifecycle-create-mtls/tests/{filename}"
            in readme
        )
    assert (
        "python3 -m pytest integration/compose/soc-ai-lifecycle-create-mtls/tests\n"
        not in readme
    )
    assert "CYBRIK_UAT_D1_ARTIFACT_DIR" in readme


def test_d1_delegated_authority_is_recorded_without_opening_runtime() -> None:
    decision = (
        _REPO_ROOT / "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md"
    ).read_text(encoding="utf-8")
    assert (
        "Current state: `AUTHORIZED — D1 DEPENDENCY ARTIFACT COMPLETE — RUNTIME NOT RUN`"
        in decision
    )
    assert (
        "Current state: `ACCEPTED AND IMPLEMENTED BY D1 ARTIFACT ONLY — NO RUNTIME`"
        in decision
    )
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
    assert (
        current["executed_checks"],
        current["passed_checks"],
        current["failed_checks"],
    ) == (0, 0, 0)
    assert record["disposition"]["profile"] == "HOLD"
    assert record["evidence"]["final_profile_verdict"] == "HOLD"
    assert current["evidence_sha256"] == _sha256(hold_path)
    assert record["evidence"]["artifacts"] == [
        {
            "path": hold_path.relative_to(_REPO_ROOT).as_posix(),
            "sha256": _sha256(hold_path),
        },
        {
            "path": architecture_path.relative_to(_REPO_ROOT).as_posix(),
            "sha256": _sha256(architecture_path),
        },
    ]
