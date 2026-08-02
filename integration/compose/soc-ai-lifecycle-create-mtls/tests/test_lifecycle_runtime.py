"""Static controls plus the fail-closed collection guard for D2 runtime tests.

No function in this file is a permitted preflight execution target. Phase A
must pin this file by digest; Phase B may execute it only after the committed
candidate record and independent authorization both open the exact attempt.
"""

from __future__ import annotations

import ast
import json
import os
import ssl
from pathlib import Path
from types import SimpleNamespace
from typing import Self

import pytest

from cybrik_suite_uat_mtls import harness, procedure

_ROOT = Path(__file__).resolve().parents[1]
_HARNESS = _ROOT / "src/cybrik_suite_uat_mtls/harness.py"


def test_harness_exposes_exactly_the_five_allowlisted_operator_steps() -> None:
    assert _HARNESS.is_file(), "D2 harness module is not authored"
    tree = ast.parse(_HARNESS.read_text(encoding="utf-8"), filename=str(_HARNESS))
    literals = {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }
    for step in procedure.LIFECYCLE_STEPS:
        assert step in literals
    assert "serve-ai" not in literals
    assert "soc-create" not in literals


def test_runtime_entrypoint_has_a_committed_authorization_guard() -> None:
    source = _HARNESS.read_text(encoding="utf-8") if _HARNESS.is_file() else ""
    for required in (
        "CYBRIK_UAT_D2_EXECUTION_AUTHORIZED",
        "CYBRIK_UAT_D2_AUTHORIZATION_PATH",
        "CYBRIK_UAT_D2_AUTHORIZATION_SHA256",
        "execution_authorized",
        "not_run",
        "RUNTIME_ROOT=",
        "EVIDENCE_ROOT=",
    ):
        assert required in source


def test_missing_pinned_trust_factory_is_wrapped_as_authorization_failure() -> None:
    tree = ast.parse(_HARNESS.read_text(encoding="utf-8"), filename=str(_HARNESS))
    compatibility = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef)
        and node.name == "assert_product_api_compatibility"
    )
    guarded = "\n".join(
        ast.unparse(statement)
        for statement in compatibility.body
        if isinstance(statement, ast.Try)
    )
    assert "from_pinned_jwks = PinnedTrustProvider.from_pinned_jwks" in guarded
    assert "from_pinned_jwks" in ast.unparse(compatibility)


def test_runtime_driver_is_collected_but_cannot_run_without_phase_a() -> None:
    source = Path(__file__).read_text(encoding="utf-8")
    harness_source = _HARNESS.read_text(encoding="utf-8") if _HARNESS.is_file() else ""
    assert 'os.environ.get("CYBRIK_UAT_D2_EXECUTION_AUTHORIZED") != "true"' in source
    assert "pytest.skip" in source
    assert "assert_runtime_authorized" in harness_source
    assert "runtime authorization is closed" in harness_source


def test_authorized_runtime_attempt_executes_the_red_green_sequence() -> None:
    """Phase B target. Do not select before the exact authorization opens."""

    if os.environ.get("CYBRIK_UAT_D2_EXECUTION_AUTHORIZED") != "true":
        pytest.skip("D2 Phase A authorization is closed")

    from cybrik_suite_uat_mtls.harness import run_runtime_attempt

    summary = run_runtime_attempt()
    assert summary == {
        "case_count": 10,
        "failed_count": 0,
        "mtls_client_certificate_count": 1,
        "mtls_client_cert_error_absent": True,
        "mtls_server_certificate_present": True,
        "mtls_tls_version": 0x0304,
        "passed_count": 10,
        "postgres_force_rls_table_count": 5,
        "postgres_replay_row_count": 1,
        "postgres_role_posture_verified": True,
        "postgres_rls_isolation_verified": True,
        "relying_party_refusal_count": 9,
        "runtime_red_case_id": "N8",
        "ssl_hardened_options_preserved": True,
        "ssl_no_compression_verified": True,
    }


def test_ssl_context_evidence_rejects_missing_file(tmp_path: Path) -> None:
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="SSL-context evidence is absent"
    ):
        harness._assert_ssl_context_evidence(tmp_path)


def test_ssl_context_evidence_rejects_non_integer_options(tmp_path: Path) -> None:
    (tmp_path / "ssl-context.json").write_text(
        json.dumps(
            {
                "baseline_options": True,
                "result_options": 1,
                "hardened_options_preserved": True,
                "no_compression_verified": True,
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="SSL-context option evidence is invalid",
    ):
        harness._assert_ssl_context_evidence(tmp_path)


def test_ssl_context_evidence_rejects_mismatched_no_compression_flag(
    tmp_path: Path,
) -> None:
    baseline = int(ssl.create_default_context(ssl.Purpose.CLIENT_AUTH).options)
    (tmp_path / "ssl-context.json").write_text(
        json.dumps(
            {
                "baseline_options": baseline,
                "result_options": baseline,
                "hardened_options_preserved": True,
                "no_compression_verified": not bool(baseline & ssl.OP_NO_COMPRESSION),
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="SSL compression evidence is inconsistent",
    ):
        harness._assert_ssl_context_evidence(tmp_path)


def test_ssl_context_evidence_rejects_incomplete_hardening_even_when_flags_match(
    tmp_path: Path,
) -> None:
    baseline = int(ssl.create_default_context(ssl.Purpose.CLIENT_AUTH).options)
    result = baseline & ~ssl.OP_NO_COMPRESSION
    (tmp_path / "ssl-context.json").write_text(
        json.dumps(
            {
                "baseline_options": baseline,
                "result_options": result,
                "hardened_options_preserved": (result & baseline) == baseline,
                "no_compression_verified": bool(result & ssl.OP_NO_COMPRESSION),
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="SSL-context hardening is incomplete",
    ):
        harness._assert_ssl_context_evidence(tmp_path)


def test_absolute_env_rejects_missing_or_relative_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CYBRIK_UAT_D2_RUNTIME_DIR", raising=False)
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="required D2 absolute path is absent"
    ):
        harness._absolute_env("CYBRIK_UAT_D2_RUNTIME_DIR", must_exist=False)

    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", "relative/path")
    with pytest.raises(
        harness.RuntimeAuthorizationError, match="required D2 absolute path is absent"
    ):
        harness._absolute_env("CYBRIK_UAT_D2_RUNTIME_DIR", must_exist=False)


def test_absolute_env_resolves_parent_for_fresh_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    parent = tmp_path / "holder"
    parent.mkdir()
    candidate = parent / "future-root"
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(candidate))

    assert harness._absolute_env(
        "CYBRIK_UAT_D2_RUNTIME_DIR", must_exist=False
    ) == candidate.resolve(strict=False)


def test_bounded_external_roots_rejects_bad_name_and_overlap(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(harness, "_outside_repositories", lambda candidate, **_: None)

    invalid_runtime = tmp_path / "runtime"
    invalid_evidence = tmp_path / "cybrik-uat-d2-evidence-valid"
    invalid_runtime.parent.mkdir(exist_ok=True)
    invalid_evidence.parent.mkdir(exist_ok=True)
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(invalid_runtime))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(invalid_evidence))
    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="D2 external root name is not purpose-bound",
    ):
        harness._bounded_external_roots(repositories_must_exist=False)

    runtime_root = tmp_path / "cybrik-uat-d2-runtime-good"
    evidence_root = runtime_root / "cybrik-uat-d2-evidence-nested"
    runtime_root.mkdir()
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(runtime_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(evidence_root))
    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="runtime and evidence roots must be disjoint",
    ):
        harness._bounded_external_roots(repositories_must_exist=False)


def test_bounded_external_roots_accepts_purpose_bound_disjoint_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-good"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-good"
    seen: list[Path] = []

    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(runtime_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(evidence_root))
    monkeypatch.setattr(
        harness,
        "_outside_repositories",
        lambda candidate, **_: seen.append(candidate),
    )

    assert harness._bounded_external_roots(repositories_must_exist=False) == (
        runtime_root.resolve(strict=False),
        evidence_root.resolve(strict=False),
    )
    assert seen == [
        runtime_root.resolve(strict=False),
        evidence_root.resolve(strict=False),
    ]


def test_assert_runtime_authorized_rejects_invalid_digest_before_file_reads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CYBRIK_UAT_D2_EXECUTION_AUTHORIZED", "true")
    monkeypatch.setenv("CYBRIK_UAT_D2_AUTHORIZATION_SHA256", "not-hex")
    monkeypatch.setattr(
        harness,
        "_absolute_env",
        lambda name, *, must_exist: tmp_path / "authorization.md",
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="runtime authorization digest is invalid",
    ):
        harness.assert_runtime_authorized()


def test_assert_runtime_authorized_rejects_nonzero_attempt_counters(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo_root = tmp_path / "repo"
    authorization = repo_root / harness._AUTHORIZATION_REL
    authorization.parent.mkdir(parents=True)
    authorization.write_text("SUITE_SHA=" + ("a" * 40), encoding="utf-8")
    candidate = repo_root / harness._CANDIDATE_REL
    candidate.parent.mkdir(parents=True, exist_ok=True)
    candidate.write_text(
        json.dumps(
            {
                "attempt_accounting": {
                    "current_attempt": {
                        "execution_authorized": True,
                        "status": "not_run",
                        "executed_checks": 1,
                        "passed_checks": 0,
                        "failed_checks": 0,
                    }
                },
                "evidence": {
                    "artifacts": [
                        {
                            "path": harness._AUTHORIZATION_REL.as_posix(),
                            "sha256": "a" * 64,
                        }
                    ]
                },
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("CYBRIK_UAT_D2_EXECUTION_AUTHORIZED", "true")
    monkeypatch.setenv("CYBRIK_UAT_D2_AUTHORIZATION_SHA256", "a" * 64)
    monkeypatch.setattr(
        harness,
        "_absolute_env",
        lambda name, *, must_exist: (
            authorization
            if name == harness._AUTHORIZATION_PATH_ENV
            else tmp_path / "unused"
        ),
    )
    monkeypatch.setattr(harness, "_repo_root", lambda: repo_root)
    monkeypatch.setattr(harness, "_sha256", lambda path: "a" * 64)
    monkeypatch.setattr(
        harness, "_git", lambda *args: "a" * 40 if args == ("rev-parse", "HEAD") else ""
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="runtime attempt counters are not zero",
    ):
        harness.assert_runtime_authorized()


def test_password_rejects_missing_and_short_file(tmp_path: Path) -> None:
    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="ephemeral PostgreSQL credential is absent",
    ):
        harness._password(tmp_path)

    password_file = tmp_path / "postgres-password"
    password_file.write_text("short", encoding="ascii")
    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="ephemeral PostgreSQL credential is invalid",
    ):
        harness._password(tmp_path)


def test_password_returns_long_ascii_value(tmp_path: Path) -> None:
    value = "a" * 64
    (tmp_path / "postgres-password").write_text(value, encoding="ascii")
    assert harness._password(tmp_path) == value


def test_server_environment_pins_runtime_paths_and_strip_flag(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime = SimpleNamespace(admin_dsn="postgresql://example")
    monkeypatch.setattr(harness, "_postgres_runtime", lambda root: runtime)
    monkeypatch.setenv("KEEP_ME", "present")

    environment = harness._server_environment(
        tmp_path / "runtime", tmp_path / "evidence", strip_tls=True
    )

    assert environment["KEEP_ME"] == "present"
    assert environment["CYBRIK_UAT_D2_PKI_ROOT"] == str(tmp_path / "runtime" / "pki")
    assert environment["CYBRIK_UAT_D2_JWKS"] == str(
        tmp_path / "runtime" / "pki" / "jwt-public-jwk.json"
    )
    assert environment["CYBRIK_UAT_D2_POSTGRES_DSN"] == runtime.admin_dsn
    assert environment["CYBRIK_UAT_D2_STRIP_TLS_EXTENSION"] == "true"
    assert environment[harness._RUNTIME_DIR_ENV] == str(tmp_path / "runtime")
    assert environment[harness._EVIDENCE_DIR_ENV] == str(tmp_path / "evidence")


def test_record_pid_writes_decimal_pid(tmp_path: Path) -> None:
    destination = tmp_path / "ai-server.pid"
    harness._record_pid(destination, 4321)
    assert destination.read_text(encoding="ascii") == "4321"


class _FakeTlsSocket:
    def __init__(self, *, version: str) -> None:
        self._version = version

    def __enter__(self) -> Self:
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None

    def version(self) -> str:
        return self._version


class _FakeSslContext:
    def __init__(self, *, version: str = "TLSv1.3") -> None:
        self.minimum_version: object | None = None
        self.maximum_version: object | None = None
        self.loaded_chain: tuple[str, str] | None = None
        self.version = version

    def load_cert_chain(self, cert: str, key: str) -> None:
        self.loaded_chain = (cert, key)

    def wrap_socket(self, raw: object, *, server_hostname: str) -> _FakeTlsSocket:
        assert server_hostname == "127.0.0.1"
        return _FakeTlsSocket(version=self.version)


def test_wait_ai_listener_returns_after_tls13_readiness(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    context = _FakeSslContext()
    connections: list[tuple[tuple[str, int], float]] = []
    process = SimpleNamespace(poll=lambda: None)

    monkeypatch.setattr(
        harness.ssl,
        "create_default_context",
        lambda *, cafile: context,
    )
    monkeypatch.setattr(
        harness.socket,
        "create_connection",
        lambda address, timeout: (
            connections.append((address, timeout)) or _FakeTlsSocket(version="raw")
        ),
    )

    harness._wait_ai_listener(tmp_path, process)

    assert context.loaded_chain == (
        str(tmp_path / "pki/client-cert.pem"),
        str(tmp_path / "pki/client-key.pem"),
    )
    assert context.minimum_version is ssl.TLSVersion.TLSv1_3
    assert context.maximum_version is ssl.TLSVersion.TLSv1_3
    assert connections == [(("127.0.0.1", 58443), 0.25)]


def test_wait_ai_listener_rejects_exited_process_before_readiness(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        harness.ssl,
        "create_default_context",
        lambda *, cafile: _FakeSslContext(),
    )
    process = SimpleNamespace(poll=lambda: 1)

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="AI server exited before readiness",
    ):
        harness._wait_ai_listener(tmp_path, process)


def test_mtls_evidence_rejects_invalid_cipher_suite(tmp_path: Path) -> None:
    (tmp_path / "tls-extension.json").write_text(
        json.dumps(
            {
                "client_certificate_count": 1,
                "client_cert_error_absent": True,
                "server_certificate_present": True,
                "tls_version": 0x0304,
                "cipher_suite": True,
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="mTLS cipher-suite evidence is invalid",
    ):
        harness._assert_mtls_evidence(tmp_path)


def test_mtls_evidence_returns_validated_exact_summary(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    record = {
        "client_certificate_count": 1,
        "client_cert_error_absent": True,
        "server_certificate_present": True,
        "tls_version": 0x0304,
        "cipher_suite": 4865,
    }
    expected = {
        "mtls_client_certificate_count": 1,
        "mtls_client_cert_error_absent": True,
        "mtls_server_certificate_present": True,
        "mtls_tls_version": 0x0304,
    }
    (tmp_path / "tls-extension.json").write_text(
        json.dumps(record),
        encoding="utf-8",
    )
    validated: list[object] = []
    real_validate_evidence = harness.evidence.validate_evidence

    def validate_evidence(value: object) -> object:
        validated.append(value)
        return real_validate_evidence(value)

    monkeypatch.setattr(harness.evidence, "validate_evidence", validate_evidence)

    assert harness._assert_mtls_evidence(tmp_path) == expected
    assert validated == [expected]


def test_postgres_security_summary_rejects_missing_and_incomplete_records(
    tmp_path: Path,
) -> None:
    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="PostgreSQL security evidence is absent",
    ):
        harness._postgres_security_summary(tmp_path)

    (tmp_path / "postgres-security.json").write_text("{}", encoding="utf-8")
    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="PostgreSQL security evidence is incomplete",
    ):
        harness._postgres_security_summary(tmp_path)


def test_postgres_security_summary_returns_expected_shape(
    tmp_path: Path,
) -> None:
    expected = {
        "postgres_force_rls_table_count": harness.store.RLS_TABLE_COUNT,
        "postgres_role_posture_verified": True,
        "postgres_rls_isolation_verified": True,
    }
    (tmp_path / "postgres-security.json").write_text(
        json.dumps(expected), encoding="utf-8"
    )
    assert harness._postgres_security_summary(tmp_path) == expected
