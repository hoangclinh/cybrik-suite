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
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Self

import pytest

from cybrik_suite_uat_mtls import harness, procedure
from cybrik_suite_uat_mtls import runtime_authorization as runtime_auth

_ROOT = Path(__file__).resolve().parents[1]
_HARNESS = _ROOT / "src/cybrik_suite_uat_mtls/harness.py"
_AUTHORIZATION_MODULE = _ROOT / "src/cybrik_suite_uat_mtls/runtime_authorization.py"
_ONE_SHOT_STEP_GUARDS = {
    "start": ("assert_runtime_authorized", "consume_once"),
    "seed": ("assert_runtime_authorized", "verify_consumed"),
    "reset": ("assert_runtime_authorized", "verify_consumed"),
    "stop": ("assert_runtime_authorized", "verify_consumed"),
    "run_runtime_attempt": ("assert_runtime_authorized", "verify_consumed"),
    "rollback": ("verify_consumption_marker", "teardown"),
}


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
    harness_source = _HARNESS.read_text(encoding="utf-8") if _HARNESS.is_file() else ""
    module_source = (
        _AUTHORIZATION_MODULE.read_text(encoding="utf-8")
        if _AUTHORIZATION_MODULE.is_file()
        else ""
    )
    source = harness_source + "\n" + module_source
    for required in (
        "CYBRIK_UAT_D2_EXECUTION_AUTHORIZED",
        "CYBRIK_UAT_D2_AUTHORIZATION_PATH",
        "CYBRIK_UAT_D2_AUTHORIZATION_SHA256",
        "execution_authorized",
        "not_run",
        "RUNTIME_ROOT",
        "EVIDENCE_ROOT",
        "SUITE_ADMISSION_BASE",
        "RUNTIME_CODE_AGGREGATE_SHA256",
    ):
        assert required in source


def test_runtime_guard_declares_no_impossible_self_referential_suite_head() -> None:
    harness_source = _HARNESS.read_text(encoding="utf-8") if _HARNESS.is_file() else ""
    module_source = (
        _AUTHORIZATION_MODULE.read_text(encoding="utf-8")
        if _AUTHORIZATION_MODULE.is_file()
        else ""
    )
    assert module_source, "the D2 runtime authorization module is not authored"
    for forbidden in ("SUITE_SHA=", "SUITE_SHA={", 'f"SUITE_SHA'):
        assert forbidden not in harness_source
        assert forbidden not in module_source


def test_every_mutating_step_binds_the_one_shot_consumption_marker() -> None:
    tree = ast.parse(_HARNESS.read_text(encoding="utf-8"), filename=str(_HARNESS))
    functions = {
        node.name: node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)
    }
    for step, required_calls in _ONE_SHOT_STEP_GUARDS.items():
        assert step in functions, step
        body = ast.unparse(functions[step])
        for call in required_calls:
            assert f"{call}(" in body, f"{step} does not call {call}"


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


def test_product_api_compatibility_confines_actual_import_origins() -> None:
    tree = ast.parse(_HARNESS.read_text(encoding="utf-8"), filename=str(_HARNESS))
    compatibility = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef)
        and node.name == "assert_product_api_compatibility"
    )
    body = ast.unparse(compatibility)

    assert "runtime_authorization.verify_module_origins" in body
    assert "__module__" in body
    assert "__file__" in body


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


def test_runner_verifies_the_same_exact_bindings_as_every_runtime_step() -> None:
    runner = (
        _ROOT.parents[2] / "tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh"
    ).read_text(encoding="utf-8")

    assert "SUITE_EXPECTED_HEAD" not in runner
    for required in (
        "--untracked-files=all --ignored",
        "symbolic-ref",
        "merge-base --is-ancestor",
        "cybrik_suite_uat_mtls.runtime_authorization",
        "--check-only",
        "PYTHONPATH",
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD=1",
        "-p no:cacheprovider",
        "-o addopts=",
        "--noconftest",
        "-c /dev/null",
    ):
        assert required in runner, required
    for relative in (
        "integration/compose/soc-ai-lifecycle-create-mtls/src",
        "services/api/src",
        "packages/ai-core/src",
        "services/ai-api/src",
    ):
        assert relative in runner


def test_exact_runner_pytest_flags_leave_ignored_status_clean_for_stop(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "synthetic-clean-checkout"
    repository.mkdir()
    (repository / ".gitignore").write_text(
        ".pytest_cache/\n__pycache__/\n*.pyc\n", encoding="utf-8"
    )
    smoke = repository / "test_smoke.py"
    smoke.write_text("def test_smoke():\n    assert True\n", encoding="utf-8")
    subprocess.run(("git", "init", "-q", str(repository)), check=True)
    subprocess.run(("git", "-C", str(repository), "add", "."), check=True)
    subprocess.run(
        (
            "git",
            "-C",
            str(repository),
            "-c",
            "user.name=Cybrik UAT",
            "-c",
            "user.email=uat@invalid.local",
            "commit",
            "-q",
            "-m",
            "synthetic fixture",
        ),
        check=True,
    )
    environment = dict(os.environ)
    environment.update(
        {
            "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
        }
    )

    completed = subprocess.run(
        (
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "-p",
            "no:cacheprovider",
            "-o",
            "addopts=",
            "--noconftest",
            "-c",
            "/dev/null",
            str(smoke),
        ),
        cwd=repository,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    status = subprocess.run(
        (
            "git",
            "-C",
            str(repository),
            "status",
            "--porcelain",
            "--untracked-files=all",
            "--ignored",
        ),
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    ).stdout

    assert completed.returncode == 0, completed.stderr
    assert status == ""


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


def test_assert_runtime_authorized_delegates_to_the_exact_binding_module(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sentinel = object()
    monkeypatch.setattr(
        harness.runtime_authorization,
        "authorize_from_environment",
        lambda: sentinel,
    )

    assert harness.assert_runtime_authorized() is sentinel


def test_assert_runtime_authorized_wraps_a_stable_fail_closed_reason(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def refuse() -> object:
        raise runtime_auth.RuntimeAuthorizationFailure("candidate_closed")

    monkeypatch.setattr(
        harness.runtime_authorization, "authorize_from_environment", refuse
    )

    with pytest.raises(harness.RuntimeAuthorizationError, match="candidate_closed"):
        harness.assert_runtime_authorized()


def _stub_authorization(tmp_path: Path) -> SimpleNamespace:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-step"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-step"
    return SimpleNamespace(runtime_root=runtime_root, evidence_root=evidence_root)


def _bind_step_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> SimpleNamespace:
    stub = _stub_authorization(tmp_path)
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(stub.runtime_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(stub.evidence_root))
    monkeypatch.setattr(harness, "assert_runtime_authorized", lambda: stub)
    return stub


def test_start_consumes_the_one_shot_authorization_before_creating_runtime_state(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub = _bind_step_environment(tmp_path, monkeypatch)
    consumed: list[object] = []
    monkeypatch.setattr(harness, "assert_product_api_compatibility", lambda _: None)
    monkeypatch.setattr(
        harness.runtime_authorization,
        "consume_once",
        lambda authorization: (
            consumed.append(authorization),
            authorization.evidence_root.mkdir(mode=0o700),
            {"status": "consumed"},
        )[-1],
    )
    monkeypatch.setattr(harness.store, "start", lambda runtime: None)
    monkeypatch.setattr(harness, "_postgres_runtime", lambda root: object())

    harness.start()

    assert consumed == [stub]
    assert (stub.runtime_root / "postgres-password").is_file()
    assert stub.evidence_root.is_dir()


@pytest.mark.parametrize("step", ("seed", "reset", "stop"))
def test_later_steps_verify_the_marker_and_never_reconsume(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, step: str
) -> None:
    stub = _bind_step_environment(tmp_path, monkeypatch)
    stub.runtime_root.mkdir()
    stub.evidence_root.mkdir()
    verified: list[object] = []

    def refuse_consumption(authorization: object) -> object:
        raise AssertionError("a later step must never consume the authorization")

    monkeypatch.setattr(
        harness.runtime_authorization,
        "verify_consumed",
        lambda authorization: verified.append(authorization),
    )
    monkeypatch.setattr(
        harness.runtime_authorization, "consume_once", refuse_consumption
    )
    monkeypatch.setattr(harness.pki, "create_ephemeral_pki", lambda *a, **k: None)
    monkeypatch.setattr(harness.store, "migrate", lambda runtime: None)
    monkeypatch.setattr(harness.store, "stop", lambda: None)
    monkeypatch.setattr(
        harness.store,
        "audit_security_posture",
        lambda runtime: {
            "postgres_force_rls_table_count": harness.store.RLS_TABLE_COUNT,
            "postgres_role_posture_verified": True,
            "postgres_rls_isolation_verified": True,
        },
    )
    monkeypatch.setattr(harness, "_postgres_runtime", lambda root: object())
    monkeypatch.setattr(harness, "_repo_root", lambda: tmp_path / "repo")
    monkeypatch.setattr(
        harness, "_absolute_env", lambda name, *, must_exist: tmp_path / name
    )

    getattr(harness, step)()

    assert verified == [stub]


def _bind_rollback_roots(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[Path, Path]:
    runtime_root = tmp_path / "cybrik-uat-d2-runtime-rollback"
    evidence_root = tmp_path / "cybrik-uat-d2-evidence-rollback"
    monkeypatch.setenv("CYBRIK_UAT_D2_RUNTIME_DIR", str(runtime_root))
    monkeypatch.setenv("CYBRIK_UAT_D2_EVIDENCE_DIR", str(evidence_root))
    monkeypatch.setattr(harness, "_outside_repositories", lambda candidate, **_: None)
    return runtime_root, evidence_root


def test_rollback_is_a_noop_only_when_both_roots_are_absent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    checked: list[tuple[Path, Path | None]] = []
    teardown_calls: list[str] = []

    def record_marker_check(
        evidence_root: Path, *, expected_runtime_root: Path | None = None, **_: object
    ) -> None:
        checked.append((evidence_root, expected_runtime_root))

    monkeypatch.setattr(
        harness.runtime_authorization,
        "verify_consumption_marker",
        record_marker_check,
    )
    monkeypatch.setattr(harness, "teardown", lambda: teardown_calls.append("called"))
    _runtime_root, _evidence_root = _bind_rollback_roots(tmp_path, monkeypatch)

    harness.rollback()

    assert checked == []
    assert teardown_calls == []


def test_rollback_refuses_foreign_runtime_material_without_a_marker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root, _ = _bind_rollback_roots(tmp_path, monkeypatch)
    runtime_root.mkdir(mode=0o700)
    (runtime_root / "foreign.txt").write_text("preserve", encoding="utf-8")
    teardown_calls: list[str] = []
    monkeypatch.setenv("CYBRIK_UAT_D2_AUTHORIZATION_SHA256", "a" * 64)
    monkeypatch.setattr(harness, "teardown", lambda: teardown_calls.append("called"))

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="runtime material exists without a consumed authorization",
    ):
        harness.rollback()

    assert teardown_calls == []
    assert (runtime_root / "foreign.txt").read_text(encoding="utf-8") == "preserve"


def test_rollback_refuses_partial_evidence_root_without_a_marker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, evidence_root = _bind_rollback_roots(tmp_path, monkeypatch)
    evidence_root.mkdir(mode=0o700)
    (evidence_root / "foreign.json").write_text("{}", encoding="utf-8")
    teardown_calls: list[str] = []
    monkeypatch.setenv("CYBRIK_UAT_D2_AUTHORIZATION_SHA256", "a" * 64)
    monkeypatch.setattr(harness, "teardown", lambda: teardown_calls.append("called"))

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="consumed authorization marker is invalid",
    ):
        harness.rollback()

    assert teardown_calls == []
    assert (evidence_root / "foreign.json").is_file()


def test_rollback_tears_down_only_after_a_valid_consumed_marker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runtime_root, evidence_root = _bind_rollback_roots(tmp_path, monkeypatch)
    runtime_root.mkdir(mode=0o700)
    evidence_root.mkdir(mode=0o700)
    teardown_calls: list[str] = []
    marker_checks: list[tuple[Path, str | None, Path | None]] = []
    authorization_sha = "a" * 64
    monkeypatch.setenv("CYBRIK_UAT_D2_AUTHORIZATION_SHA256", authorization_sha)

    def accept_marker(
        evidence: Path,
        *,
        expected_authorization_sha256: str | None = None,
        expected_runtime_root: Path | None = None,
    ) -> dict[str, str]:
        marker_checks.append(
            (evidence, expected_authorization_sha256, expected_runtime_root)
        )
        return {"status": "consumed"}

    monkeypatch.setattr(
        harness.runtime_authorization,
        "verify_consumption_marker",
        accept_marker,
    )
    monkeypatch.setattr(harness, "teardown", lambda: teardown_calls.append("called"))
    monkeypatch.setattr(harness, "verify_absent", lambda: True)

    harness.rollback()

    assert teardown_calls == ["called"]
    assert marker_checks == [(evidence_root, authorization_sha, runtime_root)]


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
