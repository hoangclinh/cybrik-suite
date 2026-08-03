"""Fail-closed unit tests for the D2 Phase A runtime authorization boundary.

Every test here is synthetic. It builds temporary roots, hand-written
authorization text and dataclass observations. Nothing in this module starts a
listener, container, database, migration or product subprocess, reads a real
credential, or reaches the network.
"""

from __future__ import annotations

import dataclasses
import hashlib
import inspect
import json
import os
import stat
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_mtls import policy
from cybrik_suite_uat_mtls import runtime_authorization as authorization

_SOC_IDENTITY = (
    "abfdfde96afc6daa2868694de993c623daa8862e",
    "241ef24a33246918ff5cf133e7d8d004823fdf06",
)
_AI_IDENTITY = (
    "789614144686dab88500dd2bfecdd608ef0a8b8f",
    "244140e3aacd783b1bea7542f9f56ffc46cedc86",
)
_FABRIC_IDENTITY = (
    "49583be00235a0f8ad7da8cb4ea99108ad201a69",
    "ca8b4a03116bea979de89b92b2f8fef4fd31e001",
)
_PRODUCT_IDENTITY = {
    "soc": _SOC_IDENTITY,
    "cyber_ai": _AI_IDENTITY,
    "tool_fabric": _FABRIC_IDENTITY,
}
_ADMISSION_BASE = "b" * 40
_SUITE_HEAD = "c" * 40
_SUITE_TREE = "f" * 40
_AUTHORIZATION_ID = "d2-runtime-r1-20260802t1200z"
_AUTHORIZATION_SHA = "a" * 64
_EXACT_HEAD_GRANT_SHA = "e" * 64
_COVERAGE_AUTHORIZATION_ID = "d2-coverage-r1-20260802t1200z"
_COVERAGE_COMMAND_SHA = "1" * 64
_COVERAGE_WRAPPER_SHA = "2" * 64
_COVERAGE_PYTHON_SHA = "3" * 64
_ALLOWED_SIGNERS = (
    "cybrik-codex-governor ssh-ed25519 "
    "AAAAC3NzaC1lZDI1NTE5AAAAIEsyntheticValidationOnlyKey000000000000000\n"
)
_ALLOWED_SIGNERS_SHA = hashlib.sha256(_ALLOWED_SIGNERS.encode("ascii")).hexdigest()
_NOW = datetime(2026, 8, 2, 12, 0, tzinfo=UTC)


# --------------------------------------------------------------------------
# Synthetic fixtures
# --------------------------------------------------------------------------


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _suite_root(tmp_path: Path) -> Path:
    suite = tmp_path / "suite"
    for relative in authorization.RUNTIME_CODE_PATHS:
        _write(suite / relative, f"synthetic {relative}\n")
    _write(suite / authorization.AUTHORIZATION_REL.as_posix(), "AUTHORIZATION\n")
    _write(suite / authorization.CANDIDATE_REL.as_posix(), "{}\n")
    for role, relative in authorization.IMPORT_SOURCE_ROOTS:
        if role == "suite":
            (suite / relative).mkdir(parents=True, exist_ok=True)
    return suite


def _product_roots(tmp_path: Path) -> dict[str, Path]:
    roots: dict[str, Path] = {}
    for role in ("soc", "cyber_ai", "tool_fabric"):
        root = tmp_path / role.replace("_", "-")
        root.mkdir(exist_ok=True)
        for import_role, relative in authorization.IMPORT_SOURCE_ROOTS:
            if import_role == role:
                (root / relative).mkdir(parents=True, exist_ok=True)
        roots[role] = root
    return roots


def _external_roots(tmp_path: Path) -> tuple[Path, Path]:
    holder = tmp_path / "outside"
    holder.mkdir(exist_ok=True)
    return (
        holder / "cybrik-uat-d2-runtime-unit",
        holder / "cybrik-uat-d2-evidence-unit",
    )


def _canonical(record: dict[str, object]) -> bytes:
    return json.dumps(record, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


_ADMISSION_ARTIFACT_ENVIRONMENT = {
    "coverage_authorization_bytes": "CYBRIK_UAT_D2_COVERAGE_AUTHORIZATION",
    "measurement_receipt_bytes": "CYBRIK_UAT_D2_COVERAGE_MEASUREMENT_RECEIPT",
    "coverage_pass_result_bytes": "CYBRIK_UAT_D2_COVERAGE_GATE_RESULT",
    "root_preparation_receipt_bytes": "CYBRIK_UAT_D2_ROOT_PREPARATION_RECEIPT",
}


def _install_admission_artifact_environment(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    artifacts: authorization.AdmissionArtifacts,
) -> dict[str, Path]:
    artifact_root = tmp_path / "admission-artifacts"
    artifact_root.mkdir()
    paths: dict[str, Path] = {}
    for field_name, environment_name in _ADMISSION_ARTIFACT_ENVIRONMENT.items():
        path = artifact_root / f"{field_name}.json"
        path.write_bytes(getattr(artifacts, field_name))
        monkeypatch.setenv(environment_name, str(path))
        paths[field_name] = path
    return paths


def _prepared_directory(
    path: Path, inventory: tuple[str, ...] = ()
) -> dict[str, object]:
    """Prepare one runtime directory and record its exact live identity.

    The root-preparation receipt is signed material in production; a synthetic
    receipt is only admissible here when it repeats the identity and the exact
    initial inventory the prepared directory actually has.
    """

    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.chmod(0o700)
    identity = path.stat()
    return {
        "identity": {
            "mode": authorization.PREPARED_ROOT_MODE,
            "st_dev": identity.st_dev,
            "st_ino": identity.st_ino,
            "uid": identity.st_uid,
        },
        "inventory": list(inventory),
        "path": str(path),
    }


def _admission_artifacts(
    runtime_root: Path, evidence_root: Path
) -> tuple[authorization.AdmissionArtifacts, dict[str, str]]:
    """Build the exact post-commit artifact bytes and the digests pinning them."""

    coverage_authorization: dict[str, object] = {
        "authorization_id": _COVERAGE_AUTHORIZATION_ID,
        "measurement_command_sha256": _COVERAGE_COMMAND_SHA,
        "measurement_wrapper_sha256": _COVERAGE_WRAPPER_SHA,
        "pinned_python_sha256": _COVERAGE_PYTHON_SHA,
        "receipt_policy_id": authorization.COVERAGE_RECEIPT_POLICY_ID,
        "suite_commit": _SUITE_HEAD,
        "suite_tree": _SUITE_TREE,
    }
    coverage_authorization_bytes = _canonical(coverage_authorization)
    coverage_authorization_sha = _digest(coverage_authorization_bytes)
    receipt_bytes = _canonical(
        {
            "artifacts": {
                "coverage_data_sha256": "4" * 64,
                "coverage_json_sha256": "5" * 64,
            },
            "authorization": {
                "id": _COVERAGE_AUTHORIZATION_ID,
                "sha256": coverage_authorization_sha,
            },
            "execution_boundary": {"network_calls": [], "runtime_executed": False},
            "producer": {
                "executable_sha256": _COVERAGE_PYTHON_SHA,
                "identity": authorization.COVERAGE_PRODUCER_IDENTITY,
                "wrapper_sha256": _COVERAGE_WRAPPER_SHA,
            },
            "receipt_id": "d2-coverage-unit-receipt",
            "run": {
                "command_sha256": _COVERAGE_COMMAND_SHA,
                "id": "d2-coverage-unit-run",
                "nonce": "6" * 64,
            },
            "schema_version": authorization.COVERAGE_MEASUREMENT_RECEIPT_SCHEMA,
            "source": {"suite_commit": _SUITE_HEAD, "suite_tree": _SUITE_TREE},
        }
    )
    pass_result_bytes = _canonical(
        {
            "binding": {
                "coverage_authorization_sha256": coverage_authorization_sha,
                "measurement_receipt_sha256": _digest(receipt_bytes),
                "suite_commit": _SUITE_HEAD,
                "suite_tree": _SUITE_TREE,
            },
            "branch": {"covered": 12, "ratio": 1.0, "total": 12},
            "line": {"covered": 68, "ratio": 1.0, "total": 68},
            "status": authorization.COVERAGE_ADMISSIBLE_STATUS,
        }
    )
    # The PKI leaf is prepared first so the runtime root really does hold the
    # single signed leaf its declared initial inventory names.
    prepared_pki = _prepared_directory(runtime_root / authorization.PREPARED_PKI_LEAF)
    prepared_runtime = _prepared_directory(
        runtime_root, (authorization.PREPARED_PKI_LEAF,)
    )
    preparation_bytes = _canonical(
        {
            "authorization_id": _AUTHORIZATION_ID,
            "authorization_sha256": _AUTHORIZATION_SHA,
            "roots": {
                "runtime": prepared_runtime,
                "pki": prepared_pki,
                "evidence": _prepared_directory(evidence_root),
            },
            "schema_version": authorization.ROOT_PREPARATION_SCHEMA_VERSION,
            "source": {"suite_commit": _SUITE_HEAD, "suite_tree": _SUITE_TREE},
        }
    )
    return (
        authorization.AdmissionArtifacts(
            coverage_authorization_bytes=coverage_authorization_bytes,
            measurement_receipt_bytes=receipt_bytes,
            coverage_pass_result_bytes=pass_result_bytes,
            root_preparation_receipt_bytes=preparation_bytes,
        ),
        {
            "COVERAGE_AUTHORIZATION_SHA256": coverage_authorization_sha,
            "COVERAGE_MEASUREMENT_RECEIPT_SHA256": _digest(receipt_bytes),
            "COVERAGE_GATE_RESULT_SHA256": _digest(pass_result_bytes),
            "ROOT_PREPARATION_RECEIPT_SHA256": _digest(preparation_bytes),
        },
    )


def _fields(
    *,
    suite: Path,
    runtime_root: Path,
    evidence_root: Path,
    products: dict[str, Path],
    aggregate: str,
) -> dict[str, str]:
    return {
        "D2_RUNTIME_AUTHORIZATION": "APPROVE",
        "AUTHORIZATION_ID": _AUTHORIZATION_ID,
        "AUTHORIZED_BY": "FOUNDER",
        "AUTHORIZED_AT": "2026-08-02T11:00:00+00:00",
        "AUTHORIZATION_EXPIRES_AT": "2026-08-02T15:00:00+00:00",
        "BINDING_VERSION": authorization.BINDING_VERSION,
        "EXACT_HEAD_GRANT_ALLOWED_SIGNERS_SHA256": _ALLOWED_SIGNERS_SHA,
        "SUITE_ROOT": str(suite),
        "SUITE_ADMISSION_BASE": _ADMISSION_BASE,
        "RUNTIME_CODE_AGGREGATE_ALGORITHM": authorization.AGGREGATE_ALGORITHM,
        "RUNTIME_CODE_AGGREGATE_FILE_COUNT": str(len(authorization.RUNTIME_CODE_PATHS)),
        "RUNTIME_CODE_AGGREGATE_SHA256": aggregate,
        "B1_WHEEL_SHA256": policy.PINNED_B1_WHEEL_SHA256,
        "RUNTIME_ROOT": str(runtime_root),
        "EVIDENCE_ROOT": str(evidence_root),
        "SOC_ROOT": str(products["soc"]),
        "SOC_COMMIT": _SOC_IDENTITY[0],
        "SOC_TREE": _SOC_IDENTITY[1],
        "CYBER_AI_ROOT": str(products["cyber_ai"]),
        "CYBER_AI_COMMIT": _AI_IDENTITY[0],
        "CYBER_AI_TREE": _AI_IDENTITY[1],
        "TOOL_FABRIC_ROOT": str(products["tool_fabric"]),
        "TOOL_FABRIC_COMMIT": _FABRIC_IDENTITY[0],
        "TOOL_FABRIC_TREE": _FABRIC_IDENTITY[1],
        "ONE_SHOT": "true",
        "CONSUMPTION_MARKER": authorization.CONSUMPTION_MARKER,
        "ROLLBACK": authorization.ROLLBACK_POLICY,
    }


def _observed(
    *,
    suite: Path,
    products: dict[str, Path],
    aggregate: str,
    host_temp: Path,
    runtime_root: Path,
    evidence_root: Path,
) -> authorization.ObservedRuntimeState:
    artifacts, grant_digests = _admission_artifacts(runtime_root, evidence_root)
    exact_head_grant_path = (
        suite.parent / "grant-holder/cybrik-uat-d2-exact-head-grant-unit.txt"
    )
    _write(exact_head_grant_path, "synthetic external exact-head grant\n")
    allowed_signers_path = exact_head_grant_path.with_name(
        "cybrik-uat-d2-exact-head-allowed-signers-unit.txt"
    )
    signature_path = exact_head_grant_path.with_suffix(".txt.sig")
    _write(allowed_signers_path, _ALLOWED_SIGNERS)
    _write(signature_path, "-----BEGIN SSH SIGNATURE-----\nsynthetic\n")
    return authorization.ObservedRuntimeState(
        now=_NOW,
        suite_root=suite,
        suite_head=_SUITE_HEAD,
        suite_tree=_SUITE_TREE,
        suite_status="",
        admission_base_is_ancestor_of_head=True,
        admission_base_descends_d1_base=True,
        runtime_code_aggregate=aggregate,
        authorization_path=suite / authorization.AUTHORIZATION_REL,
        authorization_sha256=_AUTHORIZATION_SHA,
        expected_authorization_sha256=_AUTHORIZATION_SHA,
        exact_head_grant_path=exact_head_grant_path,
        exact_head_grant_sha256=_EXACT_HEAD_GRANT_SHA,
        exact_head_grant_signature_path=signature_path,
        exact_head_grant_allowed_signers_path=allowed_signers_path,
        exact_head_grant_allowed_signers_sha256=_ALLOWED_SIGNERS_SHA,
        exact_head_grant_signature_verified=True,
        exact_head_grant={
            "D2_EXACT_HEAD_GRANT": "APPROVE",
            "AUTHORIZED_BY": "CODEX-GOVERNOR",
            "GRANT_VERSION": authorization.EXACT_HEAD_GRANT_VERSION,
            "AUTHORIZATION_SHA256": _AUTHORIZATION_SHA,
            "SUITE_HEAD": _SUITE_HEAD,
            "SUITE_TREE": _SUITE_TREE,
            "RUNTIME_CODE_AGGREGATE_SHA256": aggregate,
            **grant_digests,
        },
        b1_wheel_sha256=policy.PINNED_B1_WHEEL_SHA256,
        candidate=authorization.CandidateState(
            status="not_run",
            execution_authorized=True,
            executed_checks=0,
            passed_checks=0,
            failed_checks=0,
            authorization_sha256=_AUTHORIZATION_SHA,
        ),
        products=tuple(
            authorization.ObservedProduct(
                role=role,
                root=products[role],
                commit=_PRODUCT_IDENTITY[role][0],
                tree=_PRODUCT_IDENTITY[role][1],
                detached=True,
                status="",
            )
            for role in ("soc", "cyber_ai", "tool_fabric")
        ),
        host_temp_root=host_temp,
        admission_artifacts=artifacts,
    )


@dataclasses.dataclass(frozen=True)
class _Fixture:
    suite: Path
    products: dict[str, Path]
    runtime_root: Path
    evidence_root: Path
    aggregate: str
    fields: dict[str, str]
    observed: authorization.ObservedRuntimeState


def _fixture(tmp_path: Path) -> _Fixture:
    suite = _suite_root(tmp_path)
    products = _product_roots(tmp_path)
    runtime_root, evidence_root = _external_roots(tmp_path)
    aggregate = authorization.runtime_code_aggregate(suite)
    host_temp = tmp_path / "host-temp"
    host_temp.mkdir(exist_ok=True)
    return _Fixture(
        suite=suite,
        products=products,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        aggregate=aggregate,
        fields=_fields(
            suite=suite,
            runtime_root=runtime_root,
            evidence_root=evidence_root,
            products=products,
            aggregate=aggregate,
        ),
        observed=_observed(
            suite=suite,
            products=products,
            aggregate=aggregate,
            host_temp=host_temp,
            runtime_root=runtime_root,
            evidence_root=evidence_root,
        ),
    )


def _validated(tmp_path: Path) -> authorization.RuntimeAuthorization:
    fixture = _fixture(tmp_path)
    return authorization.validate_authorization(fixture.fields, fixture.observed)


def _reason(
    fields: dict[str, str], observed: authorization.ObservedRuntimeState
) -> str:
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.validate_authorization(fields, observed)
    return caught.value.reason


# --------------------------------------------------------------------------
# The immutable binding replaces the impossible self-reference
# --------------------------------------------------------------------------


def test_two_layer_grant_binds_exact_head_without_repo_self_reference() -> None:
    assert "SUITE_SHA" not in authorization.EXPECTED_FIELDS
    assert "SUITE_HEAD" not in authorization.EXPECTED_FIELDS
    assert "SUITE_COMMIT" not in authorization.EXPECTED_FIELDS
    assert "SUITE_TREE" not in authorization.EXPECTED_FIELDS
    assert "SUITE_ADMISSION_BASE" in authorization.EXPECTED_FIELDS
    assert "RUNTIME_CODE_AGGREGATE_SHA256" in authorization.EXPECTED_FIELDS
    assert "SUITE_HEAD" in authorization.EXACT_HEAD_GRANT_FIELDS
    assert "AUTHORIZATION_SHA256" in authorization.EXACT_HEAD_GRANT_FIELDS
    assert "RUNTIME_CODE_AGGREGATE_SHA256" in authorization.EXACT_HEAD_GRANT_FIELDS
    assert authorization.EXACT_HEAD_GRANT_PINNED_VALUES == {
        "D2_EXACT_HEAD_GRANT": "APPROVE",
        "AUTHORIZED_BY": "CODEX-GOVERNOR",
        "GRANT_VERSION": authorization.EXACT_HEAD_GRANT_VERSION,
    }
    assert "EXACT_HEAD_GRANT_ALLOWED_SIGNERS_SHA256" in authorization.EXPECTED_FIELDS


def test_expected_fields_are_unique_and_pinned_values_are_a_subset() -> None:
    assert len(set(authorization.EXPECTED_FIELDS)) == len(authorization.EXPECTED_FIELDS)
    assert set(authorization.PINNED_VALUES) <= set(authorization.EXPECTED_FIELDS)
    assert authorization.PINNED_VALUES["B1_WHEEL_SHA256"] == (
        policy.PINNED_B1_WHEEL_SHA256
    )
    assert authorization.PINNED_VALUES["ONE_SHOT"] == "true"


def test_runtime_code_allowlist_is_sorted_unique_and_covers_the_runtime_surface() -> (
    None
):
    paths = authorization.RUNTIME_CODE_PATHS
    assert paths == tuple(sorted(set(paths)))
    package = (
        "integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls"
    )
    for module in (
        "__init__",
        "client",
        "evidence",
        "harness",
        "pki",
        "policy",
        "procedure",
        "runtime_authorization",
        "server",
        "store",
    ):
        assert f"{package}/{module}.py" in paths
    assert "tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh" in paths
    assert (
        "integration/compose/soc-ai-lifecycle-create-mtls/tests/"
        "test_lifecycle_runtime.py" in paths
    )
    assert "integration/compose/soc-ai-lifecycle-create-mtls/pyproject.toml" in paths
    assert authorization.MUST_BE_ABSENT_RUNTIME_PATHS == tuple(
        sorted(set(authorization.MUST_BE_ABSENT_RUNTIME_PATHS))
    )
    assert (
        "integration/compose/soc-ai-lifecycle-create-mtls/tests/conftest.py"
        in authorization.MUST_BE_ABSENT_RUNTIME_PATHS
    )
    for denied in (
        "sitecustomize.py",
        "usercustomize.py",
        "cybrik_soc",
        "cybrik_ai_api",
        "cybrik_ai_core",
    ):
        assert (
            "integration/compose/soc-ai-lifecycle-create-mtls/src/" + denied
            in authorization.MUST_BE_ABSENT_RUNTIME_PATHS
        )


def test_runtime_code_allowlist_excludes_the_authorization_and_candidate() -> None:
    assert authorization.AUTHORIZATION_REL.as_posix() not in (
        authorization.RUNTIME_CODE_PATHS
    )
    assert authorization.CANDIDATE_REL.as_posix() not in (
        authorization.RUNTIME_CODE_PATHS
    )


def test_runtime_code_allowlist_matches_the_authored_package_exactly(
    tmp_path: Path,
) -> None:
    package_root = Path(__file__).resolve().parents[1] / "src/cybrik_suite_uat_mtls"
    authored = sorted(
        path.name for path in package_root.rglob("*.py") if path.is_file()
    )
    allowlisted = sorted(
        Path(relative).name
        for relative in authorization.RUNTIME_CODE_PATHS
        if relative.startswith("integration/compose/soc-ai-lifecycle-create-mtls/src/")
    )
    assert allowlisted == authored


def test_runtime_code_aggregate_follows_the_declared_versioned_recipe(
    tmp_path: Path,
) -> None:
    suite = _suite_root(tmp_path)
    payload = f"{authorization.AGGREGATE_ALGORITHM}\n"
    payload += f"{len(authorization.RUNTIME_CODE_PATHS)}\n"
    payload += f"{len(authorization.MUST_BE_ABSENT_RUNTIME_PATHS)}\n"
    for relative in authorization.MUST_BE_ABSENT_RUNTIME_PATHS:
        payload += f"absent  {relative}\n"
    for relative in authorization.RUNTIME_CODE_PATHS:
        digest = hashlib.sha256((suite / relative).read_bytes()).hexdigest()
        payload += f"{digest}  {relative}\n"

    assert authorization.runtime_code_aggregate(suite) == (
        hashlib.sha256(payload.encode("utf-8")).hexdigest()
    )


def test_runtime_code_aggregate_refuses_an_auto_loaded_test_addition(
    tmp_path: Path,
) -> None:
    suite = _suite_root(tmp_path)
    denied = suite / authorization.MUST_BE_ABSENT_RUNTIME_PATHS[0]
    _write(denied, "def pytest_configure():\n    raise AssertionError\n")

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.runtime_code_aggregate(suite)
    assert caught.value.reason == "runtime_denied_path_present"


@pytest.mark.parametrize(
    ("relative", "content"),
    (
        ("sitecustomize.py", "raise RuntimeError('pre-guard')\n"),
        ("usercustomize.py", "raise RuntimeError('pre-guard')\n"),
        ("cybrik_soc/__init__.py", "SHADOW = True\n"),
        ("cybrik_ai_api/__init__.py", "SHADOW = True\n"),
        ("cybrik_ai_core/__init__.py", "SHADOW = True\n"),
        ("unexpected_package/__init__.py", "ADDED = True\n"),
    ),
)
def test_runtime_code_aggregate_refuses_every_unlisted_suite_source_entry(
    tmp_path: Path, relative: str, content: str
) -> None:
    suite = _suite_root(tmp_path)
    source_root = suite / "integration/compose/soc-ai-lifecycle-create-mtls/src"
    _write(source_root / relative, content)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.runtime_code_aggregate(suite)
    assert caught.value.reason in {
        "runtime_denied_path_present",
        "runtime_source_tree_not_closed",
    }


def test_runtime_code_aggregate_changes_when_runtime_code_changes(
    tmp_path: Path,
) -> None:
    suite = _suite_root(tmp_path)
    before = authorization.runtime_code_aggregate(suite)
    harness_relative = next(
        relative
        for relative in authorization.RUNTIME_CODE_PATHS
        if relative.endswith("/harness.py")
    )
    (suite / harness_relative).write_text("tampered\n", encoding="utf-8")

    assert authorization.runtime_code_aggregate(suite) != before


def test_runtime_code_aggregate_is_satisfiable_across_the_authorizing_commit(
    tmp_path: Path,
) -> None:
    """Committing the authorization itself must not invalidate the binding."""

    suite = _suite_root(tmp_path)
    before = authorization.runtime_code_aggregate(suite)
    _write(
        suite / authorization.AUTHORIZATION_REL.as_posix(),
        "D2_RUNTIME_AUTHORIZATION=APPROVE\n",
    )
    _write(suite / authorization.CANDIDATE_REL.as_posix(), '{"changed": true}\n')
    _write(suite / "docs/uat/some-other-note.md", "unrelated\n")

    assert authorization.runtime_code_aggregate(suite) == before


def test_runtime_code_aggregate_refuses_absent_or_symlinked_members(
    tmp_path: Path,
) -> None:
    suite = _suite_root(tmp_path)
    harness_relative = next(
        relative
        for relative in authorization.RUNTIME_CODE_PATHS
        if relative.endswith("/harness.py")
    )
    target = tmp_path / "elsewhere.py"
    target.write_text("elsewhere\n", encoding="utf-8")
    (suite / harness_relative).unlink()
    (suite / harness_relative).symlink_to(target)
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.runtime_code_aggregate(suite)
    assert caught.value.reason in {
        "runtime_code_path_invalid",
        "runtime_source_tree_not_closed",
    }

    (suite / harness_relative).unlink()
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.runtime_code_aggregate(suite)
    assert caught.value.reason in {
        "runtime_code_path_invalid",
        "runtime_source_tree_not_closed",
    }


# --------------------------------------------------------------------------
# Artifact parsing
# --------------------------------------------------------------------------


def test_parse_authorization_accepts_the_exact_ordered_document(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    text = "".join(
        f"{key}={fixture.fields[key]}\n" for key in authorization.EXPECTED_FIELDS
    )

    assert authorization.parse_authorization(text) == fixture.fields


def test_parse_exact_head_grant_accepts_only_the_exact_ordered_document(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    grant = fixture.observed.exact_head_grant
    text = "".join(
        f"{key}={grant[key]}\n" for key in authorization.EXACT_HEAD_GRANT_FIELDS
    )

    assert authorization.parse_exact_head_grant(text) == grant
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.parse_exact_head_grant(text + "EXTRA=denied\n")
    assert caught.value.reason == "exact_head_grant_invalid"


def test_exact_head_grant_environment_observer_verifies_detached_signature(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = _fixture(tmp_path)
    grant_path = fixture.observed.exact_head_grant_path
    payload = "".join(
        f"{key}={fixture.observed.exact_head_grant[key]}\n"
        for key in authorization.EXACT_HEAD_GRANT_FIELDS
    )
    grant_path.write_text(payload, encoding="utf-8")
    private_key = tmp_path / "ephemeral-test-only-ed25519"
    subprocess.run(
        (
            "/usr/bin/ssh-keygen",
            "-q",
            "-t",
            "ed25519",
            "-N",
            "",
            "-f",
            str(private_key),
        ),
        check=True,
        timeout=30,
    )
    public_line = private_key.with_suffix(".pub").read_text(encoding="ascii").strip()
    allowed_signers = fixture.observed.exact_head_grant_allowed_signers_path
    allowed_signers.write_text(
        f"{authorization.EXACT_HEAD_GRANT_SIGNER_IDENTITY} {public_line}\n",
        encoding="ascii",
    )
    fixture.observed.exact_head_grant_signature_path.unlink()
    subprocess.run(
        (
            "/usr/bin/ssh-keygen",
            "-Y",
            "sign",
            "-f",
            str(private_key),
            "-n",
            authorization.EXACT_HEAD_GRANT_NAMESPACE,
            str(grant_path),
        ),
        check=True,
        capture_output=True,
        timeout=30,
    )
    signature = grant_path.with_suffix(".txt.sig")
    fields = dict(fixture.fields)
    fields["EXACT_HEAD_GRANT_ALLOWED_SIGNERS_SHA256"] = hashlib.sha256(
        allowed_signers.read_bytes()
    ).hexdigest()
    monkeypatch.setenv("CYBRIK_UAT_D2_EXACT_HEAD_GRANT", str(grant_path))
    monkeypatch.setenv("CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SIGNATURE", str(signature))
    monkeypatch.setenv("CYBRIK_UAT_D2_EXACT_HEAD_ALLOWED_SIGNERS", str(allowed_signers))

    observed = authorization._exact_head_grant_from_environment(fields)
    assert observed == (
        grant_path,
        fixture.observed.exact_head_grant,
        hashlib.sha256(grant_path.read_bytes()).hexdigest(),
        signature,
        allowed_signers,
        fields["EXACT_HEAD_GRANT_ALLOWED_SIGNERS_SHA256"],
        True,
    )

    grant_path.write_text(payload.replace(_SUITE_HEAD, "d" * 40), encoding="utf-8")
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._exact_head_grant_from_environment(fields)
    assert caught.value.reason == "exact_head_grant_signature_invalid"


def test_exact_head_grant_verification_is_bound_to_the_digest_checked_signer_inode(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = _fixture(tmp_path)
    grant_path = fixture.observed.exact_head_grant_path
    payload = "".join(
        f"{key}={fixture.observed.exact_head_grant[key]}\n"
        for key in authorization.EXACT_HEAD_GRANT_FIELDS
    )
    grant_path.write_text(payload, encoding="utf-8")
    trusted_key = tmp_path / "trusted-test-only-ed25519"
    attacker_key = tmp_path / "attacker-test-only-ed25519"
    for key in (trusted_key, attacker_key):
        subprocess.run(
            (
                "/usr/bin/ssh-keygen",
                "-q",
                "-t",
                "ed25519",
                "-N",
                "",
                "-f",
                str(key),
            ),
            check=True,
            timeout=30,
        )
    allowed_signers = fixture.observed.exact_head_grant_allowed_signers_path
    trusted_public = trusted_key.with_suffix(".pub").read_text(encoding="ascii").strip()
    attacker_public = (
        attacker_key.with_suffix(".pub").read_text(encoding="ascii").strip()
    )
    allowed_signers.write_text(
        f"{authorization.EXACT_HEAD_GRANT_SIGNER_IDENTITY} {trusted_public}\n",
        encoding="ascii",
    )
    replacement = allowed_signers.with_name("replacement-allowed-signers.txt")
    replacement.write_text(
        f"{authorization.EXACT_HEAD_GRANT_SIGNER_IDENTITY} {attacker_public}\n",
        encoding="ascii",
    )
    fixture.observed.exact_head_grant_signature_path.unlink()
    subprocess.run(
        (
            "/usr/bin/ssh-keygen",
            "-Y",
            "sign",
            "-f",
            str(attacker_key),
            "-n",
            authorization.EXACT_HEAD_GRANT_NAMESPACE,
            str(grant_path),
        ),
        check=True,
        capture_output=True,
        timeout=30,
    )
    signature = grant_path.with_suffix(".txt.sig")
    fields = dict(fixture.fields)
    fields["EXACT_HEAD_GRANT_ALLOWED_SIGNERS_SHA256"] = hashlib.sha256(
        allowed_signers.read_bytes()
    ).hexdigest()
    monkeypatch.setenv("CYBRIK_UAT_D2_EXACT_HEAD_GRANT", str(grant_path))
    monkeypatch.setenv("CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SIGNATURE", str(signature))
    monkeypatch.setenv("CYBRIK_UAT_D2_EXACT_HEAD_ALLOWED_SIGNERS", str(allowed_signers))
    original_run = subprocess.run
    swapped = False

    def swap_before_verify(
        *args: object, **kwargs: object
    ) -> subprocess.CompletedProcess[bytes]:
        nonlocal swapped
        command = args[0]
        if (
            not swapped
            and isinstance(command, tuple)
            and command[:3] == ("/usr/bin/ssh-keygen", "-Y", "verify")
        ):
            os.replace(replacement, allowed_signers)
            swapped = True
        return original_run(*args, **kwargs)

    monkeypatch.setattr(authorization.subprocess, "run", swap_before_verify)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._exact_head_grant_from_environment(fields)
    assert caught.value.reason == "exact_head_grant_signature_invalid"
    assert swapped is True


def test_exact_head_grant_environment_observer_rejects_a_symlink(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = _fixture(tmp_path)
    target = fixture.observed.exact_head_grant_path
    link = target.with_name("cybrik-uat-d2-exact-head-grant-symlink.txt")
    link.symlink_to(target)
    monkeypatch.setenv("CYBRIK_UAT_D2_EXACT_HEAD_GRANT", str(link))
    monkeypatch.setenv(
        "CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SIGNATURE",
        str(fixture.observed.exact_head_grant_signature_path),
    )
    monkeypatch.setenv(
        "CYBRIK_UAT_D2_EXACT_HEAD_ALLOWED_SIGNERS",
        str(fixture.observed.exact_head_grant_allowed_signers_path),
    )

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._exact_head_grant_from_environment(fixture.fields)
    assert caught.value.reason == "exact_head_grant_path_invalid"


@pytest.mark.parametrize(
    "mutate",
    (
        lambda text: text.rstrip("\n"),
        lambda text: text.replace("\n", "\r\n", 1),
        lambda text: text + "EXTRA=value\n",
        lambda text: "\n".join(reversed(text.splitlines())) + "\n",
        lambda text: text.replace("ONE_SHOT=true", "ONE_SHOT= true"),
        lambda text: text.replace("ONE_SHOT=true", "ONE_SHOT="),
        lambda text: text.replace("ONE_SHOT=true", "ONE_SHOT"),
        lambda text: text + "\n",
    ),
)
def test_parse_authorization_fails_closed_on_malformed_documents(
    tmp_path: Path, mutate: object
) -> None:
    fixture = _fixture(tmp_path)
    text = "".join(
        f"{key}={fixture.fields[key]}\n" for key in authorization.EXPECTED_FIELDS
    )

    with pytest.raises(authorization.RuntimeAuthorizationFailure):
        authorization.parse_authorization(mutate(text))  # type: ignore[operator]


def test_read_authorization_refuses_a_symlinked_artifact(tmp_path: Path) -> None:
    target = tmp_path / "real.md"
    target.write_text("D2_RUNTIME_AUTHORIZATION=APPROVE\n", encoding="utf-8")
    link = tmp_path / "link.md"
    link.symlink_to(target)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.read_authorization(link)
    assert caught.value.reason == "authorization_artifact_invalid"


def test_read_authorization_returns_exact_bytes(tmp_path: Path) -> None:
    artifact = tmp_path / "authorization.md"
    artifact.write_bytes(b"D2_RUNTIME_AUTHORIZATION=APPROVE\n")
    os.chmod(artifact, 0o600)

    assert authorization.read_authorization(artifact) == (
        b"D2_RUNTIME_AUTHORIZATION=APPROVE\n"
    )


def test_read_authorization_closes_descriptor_when_fstat_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    read_descriptor, write_descriptor = os.pipe()
    original_fstat = os.fstat
    monkeypatch.setattr(os, "open", lambda *_args, **_kwargs: read_descriptor)
    monkeypatch.setattr(
        os,
        "fstat",
        lambda _descriptor: (_ for _ in ()).throw(OSError("synthetic fstat failure")),
    )

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.read_authorization(tmp_path / "authorization.md")
    assert caught.value.reason == "authorization_artifact_invalid"
    monkeypatch.setattr(os, "fstat", original_fstat)
    with pytest.raises(OSError):
        original_fstat(read_descriptor)
    os.close(write_descriptor)


# --------------------------------------------------------------------------
# Exact-binding validation
# --------------------------------------------------------------------------


def test_validate_authorization_admits_the_canonical_binding(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)

    validated = authorization.validate_authorization(fixture.fields, fixture.observed)

    assert validated.authorization_id == fixture.fields["AUTHORIZATION_ID"]
    assert validated.suite_root == fixture.suite
    assert validated.runtime_root == fixture.runtime_root
    assert validated.evidence_root == fixture.evidence_root
    assert validated.aggregate_sha256 == fixture.aggregate
    assert validated.authorization_sha256 == _AUTHORIZATION_SHA
    assert validated.suite_admission_base == _ADMISSION_BASE
    assert validated.product_roots == {
        role: fixture.products[role] for role in ("soc", "cyber_ai", "tool_fabric")
    }


@pytest.mark.parametrize(
    ("key", "value", "expected_reason"),
    (
        ("D2_RUNTIME_AUTHORIZATION", "HOLD", "authorization_pinned_value_mismatch"),
        ("AUTHORIZED_BY", "GOVERNOR", "authorization_pinned_value_mismatch"),
        ("ONE_SHOT", "false", "authorization_pinned_value_mismatch"),
        (
            "BINDING_VERSION",
            "CYBRIK-D2-RUNTIME-AUTH/v0",
            "authorization_pinned_value_mismatch",
        ),
        (
            "RUNTIME_CODE_AGGREGATE_ALGORITHM",
            "sha256",
            "authorization_pinned_value_mismatch",
        ),
        ("SOC_COMMIT", "d" * 40, "authorization_pinned_value_mismatch"),
        ("CYBER_AI_TREE", "d" * 40, "authorization_pinned_value_mismatch"),
        ("TOOL_FABRIC_COMMIT", "d" * 40, "authorization_pinned_value_mismatch"),
        ("AUTHORIZATION_ID", "Not Valid", "authorization_id_invalid"),
        ("SUITE_ADMISSION_BASE", "z" * 40, "authorization_digest_invalid"),
        ("RUNTIME_CODE_AGGREGATE_SHA256", "z" * 64, "authorization_digest_invalid"),
        ("SUITE_ROOT", "relative/suite", "suite_root_invalid"),
        ("AUTHORIZED_AT", "2026-08-02 11:00:00", "authorization_timestamp_invalid"),
        (
            "AUTHORIZATION_EXPIRES_AT",
            "2026-08-02T10:00:00+00:00",
            "authorization_window_invalid",
        ),
        (
            "AUTHORIZATION_EXPIRES_AT",
            "2026-08-04T11:00:00+00:00",
            "authorization_window_invalid",
        ),
    ),
)
def test_validate_authorization_rejects_field_level_defects(
    tmp_path: Path, key: str, value: str, expected_reason: str
) -> None:
    fixture = _fixture(tmp_path)
    fields = dict(fixture.fields)
    fields[key] = value

    assert _reason(fields, fixture.observed) == expected_reason


def test_validate_authorization_rejects_an_expired_or_future_window(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    late = dataclasses.replace(
        fixture.observed, now=datetime(2026, 8, 3, 12, 0, tzinfo=UTC)
    )
    early = dataclasses.replace(
        fixture.observed, now=datetime(2026, 8, 1, 12, 0, tzinfo=UTC)
    )

    assert _reason(fixture.fields, late) == "authorization_not_current"
    assert _reason(fixture.fields, early) == "authorization_not_current"


@pytest.mark.parametrize(
    ("overrides", "expected_reason"),
    (
        ({"runtime_code_aggregate": "d" * 64}, "runtime_code_aggregate_mismatch"),
        ({"admission_base_is_ancestor_of_head": False}, "suite_admission_base_invalid"),
        ({"admission_base_descends_d1_base": False}, "suite_admission_base_invalid"),
        ({"suite_status": " M docs/x.md"}, "suite_checkout_not_clean"),
        ({"suite_head": "not-a-commit"}, "suite_state_mismatch"),
        ({"b1_wheel_sha256": "d" * 64}, "b1_wheel_digest_mismatch"),
        ({"authorization_sha256": "d" * 64}, "authorization_digest_mismatch"),
        ({"expected_authorization_sha256": "d" * 64}, "authorization_digest_mismatch"),
        (
            {"exact_head_grant_sha256": "not-a-digest"},
            "exact_head_grant_digest_invalid",
        ),
        (
            {"exact_head_grant_signature_verified": False},
            "exact_head_grant_signature_invalid",
        ),
    ),
)
def test_validate_authorization_rejects_observation_level_defects(
    tmp_path: Path, overrides: dict[str, object], expected_reason: str
) -> None:
    fixture = _fixture(tmp_path)
    observed = dataclasses.replace(fixture.observed, **overrides)

    assert _reason(fixture.fields, observed) == expected_reason


@pytest.mark.parametrize(
    ("key", "value", "expected_reason"),
    (
        ("SUITE_HEAD", "d" * 40, "suite_exact_head_mismatch"),
        ("SUITE_HEAD", "not-a-commit", "exact_head_grant_invalid"),
        (
            "AUTHORIZATION_SHA256",
            "d" * 64,
            "exact_head_grant_authorization_mismatch",
        ),
        (
            "RUNTIME_CODE_AGGREGATE_SHA256",
            "d" * 64,
            "exact_head_grant_aggregate_mismatch",
        ),
        ("D2_EXACT_HEAD_GRANT", "HOLD", "exact_head_grant_pinned_value_mismatch"),
    ),
)
def test_validate_authorization_requires_external_exact_head_grant_binding(
    tmp_path: Path, key: str, value: str, expected_reason: str
) -> None:
    fixture = _fixture(tmp_path)
    grant = dict(fixture.observed.exact_head_grant)
    grant[key] = value
    observed = dataclasses.replace(fixture.observed, exact_head_grant=grant)

    assert _reason(fixture.fields, observed) == expected_reason


def test_validate_authorization_rejects_exact_head_grant_inside_suite(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    path = fixture.suite / "cybrik-uat-d2-exact-head-grant-inside.txt"
    _write(path, "not external\n")
    observed = dataclasses.replace(fixture.observed, exact_head_grant_path=path)

    assert _reason(fixture.fields, observed) == "exact_head_grant_path_invalid"


def test_validate_authorization_rejects_a_non_canonical_authorization_path(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    observed = dataclasses.replace(
        fixture.observed, authorization_path=tmp_path / "elsewhere.md"
    )

    assert _reason(fixture.fields, observed) == "authorization_path_not_canonical"


@pytest.mark.parametrize(
    ("candidate_overrides", "expected_reason"),
    (
        ({"status": "passed"}, "candidate_closed"),
        ({"execution_authorized": False}, "candidate_closed"),
        ({"executed_checks": 1}, "candidate_attempt_counters_not_zero"),
        ({"passed_checks": 1}, "candidate_attempt_counters_not_zero"),
        ({"failed_checks": 1}, "candidate_attempt_counters_not_zero"),
        ({"authorization_sha256": None}, "candidate_does_not_pin_authorization"),
        ({"authorization_sha256": "d" * 64}, "candidate_does_not_pin_authorization"),
    ),
)
def test_validate_authorization_keeps_execution_closed_for_the_candidate(
    tmp_path: Path, candidate_overrides: dict[str, object], expected_reason: str
) -> None:
    fixture = _fixture(tmp_path)
    observed = dataclasses.replace(
        fixture.observed,
        candidate=dataclasses.replace(
            fixture.observed.candidate, **candidate_overrides
        ),
    )

    assert _reason(fixture.fields, observed) == expected_reason


@pytest.mark.parametrize(
    ("product_overrides", "expected_reason"),
    (
        ({"commit": "d" * 40}, "product_identity_mismatch"),
        ({"tree": "d" * 40}, "product_identity_mismatch"),
        ({"detached": False}, "product_head_not_detached"),
        ({"status": "!! build/residue"}, "product_checkout_not_clean"),
    ),
)
def test_validate_authorization_requires_exact_detached_clean_product_roots(
    tmp_path: Path, product_overrides: dict[str, object], expected_reason: str
) -> None:
    fixture = _fixture(tmp_path)
    products = (
        dataclasses.replace(fixture.observed.products[0], **product_overrides),
        *fixture.observed.products[1:],
    )
    observed = dataclasses.replace(fixture.observed, products=products)

    assert _reason(fixture.fields, observed) == expected_reason


def test_validate_authorization_requires_the_declared_product_roots(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    products = (
        dataclasses.replace(fixture.observed.products[0], root=tmp_path / "other"),
        *fixture.observed.products[1:],
    )
    observed = dataclasses.replace(fixture.observed, products=products)

    assert _reason(fixture.fields, observed) == "product_root_mismatch"


def test_validate_authorization_requires_the_suite_root_to_match_observation(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    observed = dataclasses.replace(fixture.observed, suite_root=tmp_path / "other")

    assert _reason(fixture.fields, observed) == "suite_state_mismatch"


@pytest.mark.parametrize("key", ("RUNTIME_ROOT", "EVIDENCE_ROOT"))
def test_validate_authorization_requires_purpose_bound_external_roots(
    tmp_path: Path, key: str
) -> None:
    fixture = _fixture(tmp_path)
    fields = dict(fixture.fields)
    fields[key] = str(tmp_path / "outside/not-purpose-bound")

    assert _reason(fields, fixture.observed) == "external_root_not_purpose_bound"


def test_validate_authorization_rejects_overlapping_external_roots(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    fields = dict(fixture.fields)
    fields["EVIDENCE_ROOT"] = str(
        fixture.runtime_root / "cybrik-uat-d2-evidence-nested"
    )

    assert _reason(fields, fixture.observed) == "external_root_overlap"


@pytest.mark.parametrize("repository_key", ("SUITE_ROOT", "SOC_ROOT"))
def test_validate_authorization_rejects_roots_overlapping_a_repository(
    tmp_path: Path, repository_key: str
) -> None:
    fixture = _fixture(tmp_path)
    fields = dict(fixture.fields)
    inside = Path(fields[repository_key]) / "cybrik-uat-d2-runtime-inside"
    fields["RUNTIME_ROOT"] = str(inside)

    assert _reason(fields, fixture.observed) == "external_root_overlap"


@pytest.mark.parametrize("prefix", ("/tmp", "/private/tmp"))
def test_validate_authorization_rejects_roots_under_unsafe_temporary_trees(
    tmp_path: Path, prefix: str
) -> None:
    fixture = _fixture(tmp_path)
    fields = dict(fixture.fields)
    fields["RUNTIME_ROOT"] = f"{prefix}/cybrik-uat-d2-runtime-unsafe"

    assert _reason(fields, fixture.observed) == "external_root_under_temp"


@pytest.mark.parametrize("prefix", ("//tmp", "//private/tmp"))
def test_validate_authorization_rejects_noncanonical_double_slash_roots(
    tmp_path: Path, prefix: str
) -> None:
    fixture = _fixture(tmp_path)
    fields = dict(fixture.fields)
    fields["RUNTIME_ROOT"] = f"{prefix}/cybrik-uat-d2-runtime-unsafe"

    assert _reason(fields, fixture.observed) == "external_root_not_purpose_bound"


def test_validate_authorization_rejects_roots_under_the_host_temporary_root(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    fields = dict(fixture.fields)
    fields["EVIDENCE_ROOT"] = str(
        fixture.observed.host_temp_root / "cybrik-uat-d2-evidence-unsafe"
    )

    assert _reason(fields, fixture.observed) == "external_root_under_temp"


def test_failures_carry_a_stable_reason_without_echoing_the_candidate(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    fields = dict(fixture.fields)
    fields["AUTHORIZATION_ID"] = "SECRET-PLACEHOLDER-NOT-A-CREDENTIAL"

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.validate_authorization(fields, fixture.observed)
    rendered = f"{caught.value}{caught.value!r}{caught.value.args}"
    assert caught.value.reason == "authorization_id_invalid"
    assert "SECRET-PLACEHOLDER-NOT-A-CREDENTIAL" not in rendered


# --------------------------------------------------------------------------
# Import source roots
# --------------------------------------------------------------------------


def test_resolve_import_source_roots_returns_roots_inside_the_pinned_roots(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    validated = _validated(tmp_path)
    expected = [
        (validated.suite_root if role == "suite" else validated.product_roots[role])
        / relative
        for role, relative in authorization.IMPORT_SOURCE_ROOTS
    ]
    monkeypatch.setenv("PYTHONPATH", os.pathsep.join(str(path) for path in expected))

    assert list(authorization.resolve_import_source_roots(validated)) == expected


def test_master_reservation_resolves_signed_roots_without_ambient_pythonpath(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    suite_root = tmp_path / "suite"
    product_roots = {
        "soc": tmp_path / "soc",
        "cyber_ai": tmp_path / "ai",
        "tool_fabric": tmp_path / "fabric",
    }
    expected = tuple(
        (suite_root if role == "suite" else product_roots[role]) / relative
        for role, relative in authorization.IMPORT_SOURCE_ROOTS
    )
    for root in expected:
        root.mkdir(parents=True, exist_ok=True)
    reserved = authorization.ReservedRuntimeBinding(
        authorization_id="master-import-roots",
        suite_root=suite_root,
        suite_head="1" * 40,
        suite_admission_base="1" * 40,
        aggregate_sha256="2" * 64,
        authorization_sha256="3" * 64,
        exact_head_grant_sha256="4" * 64,
        external_roots_sha256="5" * 64,
        repository_roots_sha256="6" * 64,
        runtime_root=tmp_path / "runtime",
        evidence_root=tmp_path / "evidence",
        product_roots=product_roots,
        repository_tuple=(
            ("cybrik-soc-command-center", "7" * 40, "8" * 40),
            ("cybrik-cyber-ai-platform", "9" * 40, "a" * 40),
            ("cybrik-security-tool-fabric", "b" * 40, "c" * 40),
            ("cybrik-suite", "1" * 40, "d" * 40),
        ),
    )
    monkeypatch.setenv("PYTHONPATH", str(tmp_path / "ambient-shadow"))
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.resolve_import_source_roots(reserved)
    assert caught.value.reason == "import_path_not_pinned"

    monkeypatch.delenv("PYTHONPATH")
    assert authorization.resolve_import_source_roots(reserved) == expected

    malformed = dataclasses.replace(
        reserved,
        product_roots={"soc": product_roots["soc"]},
    )
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.resolve_import_source_roots(malformed)
    assert caught.value.reason == "import_source_root_invalid"


def test_resolve_import_source_roots_rejects_an_unpinned_pythonpath(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    validated = _validated(tmp_path)
    monkeypatch.setenv("PYTHONPATH", str(tmp_path / "attacker-src"))

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.resolve_import_source_roots(validated)
    assert caught.value.reason == "import_path_not_pinned"


def test_resolve_import_source_roots_rejects_a_symlinked_escape(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    validated = _validated(tmp_path)
    escape = tmp_path / "escape-src"
    escape.mkdir()
    role, relative = next(
        item for item in authorization.IMPORT_SOURCE_ROOTS if item[0] == "soc"
    )
    target = validated.product_roots[role] / relative
    expected = [
        (
            validated.suite_root
            if item_role == "suite"
            else validated.product_roots[item_role]
        )
        / item_relative
        for item_role, item_relative in authorization.IMPORT_SOURCE_ROOTS
    ]
    monkeypatch.setenv("PYTHONPATH", os.pathsep.join(str(path) for path in expected))
    for child in sorted(target.iterdir()):
        child.rmdir()
    target.rmdir()
    target.symlink_to(escape, target_is_directory=True)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.resolve_import_source_roots(validated)
    assert caught.value.reason == "import_source_root_invalid"


def test_verify_module_origins_rejects_a_module_outside_the_pinned_roots(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    validated = _validated(tmp_path)
    inside = validated.product_roots["soc"] / "services/api/src/cybrik_soc/__init__.py"
    inside.parent.mkdir(parents=True, exist_ok=True)
    inside.write_text("", encoding="utf-8")

    authorization.verify_module_origins(validated, (("cybrik_soc.example", inside),))

    outside = tmp_path / "elsewhere/module.py"
    outside.parent.mkdir(parents=True, exist_ok=True)
    outside.write_text("", encoding="utf-8")
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_module_origins(
            validated, (("cybrik_soc.example", outside),)
        )
    assert caught.value.reason == "import_source_root_invalid"


def test_verify_module_origins_rejects_a_swapped_symlink_source_root(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    role, relative = next(
        item for item in authorization.IMPORT_SOURCE_ROOTS if item[0] == "soc"
    )
    source_root = validated.product_roots[role] / relative
    source_root.rmdir()
    attacker_root = tmp_path / "attacker-src"
    attacker_module = attacker_root / "cybrik_soc/injected.py"
    attacker_module.parent.mkdir(parents=True)
    attacker_module.write_text("", encoding="utf-8")
    source_root.symlink_to(attacker_root, target_is_directory=True)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_module_origins(
            validated, (("cybrik_soc.injected", attacker_module),)
        )
    assert caught.value.reason == "import_source_root_invalid"


def test_verify_module_origins_binds_each_namespace_to_its_exact_role_root(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    valid = (
        (
            "cybrik_suite_uat_mtls.harness",
            validated.suite_root
            / "integration/compose/soc-ai-lifecycle-create-mtls/src/"
            "cybrik_suite_uat_mtls/harness.py",
        ),
        (
            "cybrik_soc.modules.copilot.lifecycle_create",
            validated.product_roots["soc"]
            / "services/api/src/cybrik_soc/modules/copilot/lifecycle_create.py",
        ),
        (
            "cybrik_ai_core.delegation",
            validated.product_roots["cyber_ai"]
            / "packages/ai-core/src/cybrik_ai_core/delegation.py",
        ),
        (
            "cybrik_ai_api.runtime_composition",
            validated.product_roots["cyber_ai"]
            / "services/ai-api/src/cybrik_ai_api/runtime_composition.py",
        ),
    )
    for _, path in valid:
        _write(path, "")

    authorization.verify_module_origins(validated, valid)


@pytest.mark.parametrize(
    ("module_name", "wrong_relative"),
    (
        ("cybrik_soc.injected", "services/ai-api/src/cybrik_soc/injected.py"),
        (
            "cybrik_ai_api.injected",
            "packages/ai-core/src/cybrik_ai_api/injected.py",
        ),
        ("cybrik_ai_core.injected", "services/ai-api/src/cybrik_ai_core/injected.py"),
    ),
)
def test_verify_module_origins_rejects_cross_role_shadow_packages(
    tmp_path: Path, module_name: str, wrong_relative: str
) -> None:
    validated = _validated(tmp_path)
    wrong = validated.product_roots["cyber_ai"] / wrong_relative
    _write(wrong, "")

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_module_origins(validated, ((module_name, wrong),))
    assert caught.value.reason == "import_source_root_invalid"


def test_verify_module_origins_rejects_unknown_namespaces(tmp_path: Path) -> None:
    validated = _validated(tmp_path)
    inside = (
        validated.product_roots["soc"]
        / "services/api/src/unexpected_package/injected.py"
    )
    _write(inside, "")

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_module_origins(
            validated, (("unexpected_package", inside),)
        )
    assert caught.value.reason == "import_source_root_invalid"


def test_verify_module_origins_rejects_missing_product_role_with_stable_reason(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    malformed = dataclasses.replace(
        validated,
        product_roots={"soc": validated.product_roots["soc"]},
    )

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_module_origins(
            malformed,
            (("cybrik_ai_core.delegation", tmp_path / "unreachable.py"),),
        )
    assert caught.value.reason == "import_source_root_invalid"


@pytest.mark.parametrize(
    "bad_module",
    (
        None,
        SimpleNamespace(),
        SimpleNamespace(__file__="/outside/cybrik_soc/injected.py"),
    ),
)
def test_verify_loaded_module_origins_rejects_every_unverifiable_namespace_entry(
    tmp_path: Path, bad_module: object
) -> None:
    validated = _validated(tmp_path)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_loaded_module_origins(
            validated, {"cybrik_soc.injected": bad_module}
        )
    assert caught.value.reason == "import_source_root_invalid"


def test_verify_loaded_module_origins_checks_every_loaded_namespace_entry(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    modules: dict[str, object] = {}
    for namespace, (role, relative) in authorization.MODULE_ORIGIN_ROOTS.items():
        owner = (
            validated.suite_root if role == "suite" else validated.product_roots[role]
        )
        module_file = owner / relative / "synthetic_loaded.py"
        _write(module_file, "# synthetic loaded module\n")
        modules[f"{namespace}.synthetic_loaded"] = SimpleNamespace(
            __file__=str(module_file)
        )

    authorization.verify_loaded_module_origins(validated, modules)
    assert set(modules).isdisjoint(sys.modules)


def test_verify_loaded_module_origins_accepts_exact_namespace_package_path(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    namespace_path = (
        validated.product_roots["soc"]
        / "services/api/src/cybrik_soc/modules"
    )
    namespace_path.mkdir(parents=True, exist_ok=True)
    parent_file = namespace_path.parent / "__init__.py"
    parent_file.write_text("", encoding="utf-8")
    namespace_package = SimpleNamespace(
        __file__=None,
        __path__=[str(namespace_path)],
    )

    authorization.verify_loaded_module_origins(
        validated,
        {
            "cybrik_soc": SimpleNamespace(__file__=str(parent_file)),
            "cybrik_soc.modules": namespace_package,
        },
    )


def test_verify_loaded_namespace_package_requires_verified_regular_parent(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    namespace_path = (
        validated.product_roots["soc"]
        / "services/api/src/cybrik_soc/modules"
    )
    namespace_path.mkdir(parents=True, exist_ok=True)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_loaded_module_origins(
            validated,
            {
                "cybrik_soc.modules": SimpleNamespace(
                    __file__=None,
                    __path__=[str(namespace_path)],
                )
            },
        )
    assert caught.value.reason == "import_source_root_invalid"


@pytest.mark.parametrize(
    "defect",
    ("shadow", "wrong", "non_string", "string", "non_iterable", "symlink"),
)
def test_verify_loaded_namespace_package_rejects_unpinned_paths(
    tmp_path: Path, defect: str
) -> None:
    validated = _validated(tmp_path)
    package_root = (
        validated.product_roots["soc"] / "services/api/src/cybrik_soc"
    )
    namespace_path = package_root / "modules"
    namespace_path.mkdir(parents=True, exist_ok=True)
    parent_file = package_root / "__init__.py"
    parent_file.write_text("", encoding="utf-8")
    wrong = package_root / "wrong"
    wrong.mkdir()
    if defect == "shadow":
        module_path: object = [str(namespace_path), str(wrong)]
    elif defect == "wrong":
        module_path = [str(wrong)]
    elif defect == "non_string":
        module_path = [namespace_path]
    elif defect == "string":
        module_path = str(namespace_path)
    elif defect == "non_iterable":
        module_path = object()
    else:
        namespace_path.rmdir()
        namespace_path.symlink_to(wrong, target_is_directory=True)
        module_path = [str(namespace_path)]

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_loaded_module_origins(
            validated,
            {
                "cybrik_soc": SimpleNamespace(__file__=str(parent_file)),
                "cybrik_soc.modules": SimpleNamespace(
                    __file__=None,
                    __path__=module_path,
                ),
            },
        )
    assert caught.value.reason == "import_source_root_invalid"


# --------------------------------------------------------------------------
# Atomic one-shot consumption and replay prevention
# --------------------------------------------------------------------------


def test_consume_once_writes_the_marker_in_the_bound_prepared_evidence_root(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    prepared_identity = validated.evidence_root.stat()
    marker = validated.evidence_root / authorization.CONSUMPTION_MARKER
    assert not marker.exists()

    record = authorization.consume_once(validated)

    assert stat.S_IMODE(validated.evidence_root.stat().st_mode) == 0o700
    assert validated.evidence_root.stat().st_dev == prepared_identity.st_dev
    assert validated.evidence_root.stat().st_ino == prepared_identity.st_ino
    assert stat.S_IMODE(marker.stat().st_mode) == 0o600
    assert json.loads(marker.read_text(encoding="utf-8")) == record
    assert record["status"] == "consumed"
    assert record["one_shot"] is True
    assert record["authorization_sha256"] == _AUTHORIZATION_SHA
    assert record["runtime_code_aggregate_sha256"] == validated.aggregate_sha256
    assert record["suite_admission_base"] == _ADMISSION_BASE
    assert record["evidence_root_identity"] == {
        "st_dev": validated.evidence_root.stat().st_dev,
        "st_ino": validated.evidence_root.stat().st_ino,
    }


def test_consume_once_refuses_a_second_consumption_and_preserves_evidence(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    record = authorization.consume_once(validated)
    (validated.evidence_root / "case-n1.json").write_text("{}", encoding="utf-8")

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.consume_once(validated)

    assert caught.value.reason == "authorization_already_consumed"
    assert (validated.evidence_root / "case-n1.json").is_file()
    assert (
        json.loads(
            (validated.evidence_root / authorization.CONSUMPTION_MARKER).read_text(
                encoding="utf-8"
            )
        )
        == record
    )


def test_consume_once_refuses_a_replaced_prepared_evidence_root(tmp_path: Path) -> None:
    validated = _validated(tmp_path)
    original = tmp_path / "original-evidence-root"
    validated.evidence_root.rename(original)
    validated.evidence_root.mkdir(mode=0o700)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.consume_once(validated)
    assert caught.value.reason == "authorization_consumption_mismatch"
    assert original.is_dir()
    assert validated.evidence_root.is_dir()


def test_consume_once_refuses_a_symlinked_evidence_root(tmp_path: Path) -> None:
    validated = _validated(tmp_path)
    target = tmp_path / "evidence-target"
    target.mkdir()
    original = tmp_path / "original-evidence-root"
    validated.evidence_root.rename(original)
    validated.evidence_root.symlink_to(target, target_is_directory=True)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.consume_once(validated)
    assert caught.value.reason == "authorization_consumption_mismatch"
    assert original.is_dir()
    assert target.is_dir()


def test_verify_consumed_accepts_the_marker_written_by_the_first_start(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    record = authorization.consume_once(validated)

    assert authorization.verify_consumed(validated) == record
    assert authorization.verify_consumed(validated) == record


def test_verify_consumed_accepts_a_later_cross_process_observation(
    tmp_path: Path,
) -> None:
    first_process = _validated(tmp_path)
    record = authorization.consume_once(first_process)
    later_process = dataclasses.replace(
        first_process, now=first_process.now + timedelta(minutes=30)
    )

    assert authorization.verify_consumed(later_process) == record


def test_verify_consumed_fails_closed_when_the_attempt_was_never_consumed(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumed(validated)
    assert caught.value.reason == "authorization_not_consumed"


@pytest.mark.parametrize(
    "key",
    (
        "consumed_at",
        "authorization_id",
        "authorization_sha256",
        "exact_head_grant_sha256",
        "runtime_code_aggregate_sha256",
        "suite_head",
        "suite_admission_base",
        "runtime_root",
        "evidence_root",
    ),
)
def test_verify_consumed_rejects_a_tampered_marker(tmp_path: Path, key: str) -> None:
    validated = _validated(tmp_path)
    record = authorization.consume_once(validated)
    marker = validated.evidence_root / authorization.CONSUMPTION_MARKER
    tampered = dict(record)
    tampered[key] = "tampered"
    marker.write_text(json.dumps(tampered), encoding="utf-8")

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumed(validated)
    assert caught.value.reason == "authorization_consumption_mismatch"


@pytest.mark.parametrize(
    "consumed_at",
    (
        "not-a-timestamp",
        "2026-08-02T10:59:59+00:00",
        "2026-08-02T15:00:01+00:00",
    ),
)
def test_verify_consumed_rejects_a_timestamp_outside_the_authorized_window(
    tmp_path: Path, consumed_at: str
) -> None:
    validated = _validated(tmp_path)
    authorization.consume_once(validated)
    marker = validated.evidence_root / authorization.CONSUMPTION_MARKER
    record = json.loads(marker.read_text(encoding="utf-8"))
    record["consumed_at"] = consumed_at
    marker.write_text(json.dumps(record), encoding="utf-8")

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumed(validated)
    assert caught.value.reason == "authorization_consumption_mismatch"


def test_consume_once_preserves_prepared_root_when_marker_creation_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    validated = _validated(tmp_path)
    prepared_identity = validated.evidence_root.stat()
    real_open = authorization.os.open

    def refuse_marker(path: object, *args: object, **kwargs: object) -> int:
        if path == authorization.CONSUMPTION_MARKER:
            raise OSError("synthetic marker create failure")
        return real_open(path, *args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(authorization.os, "open", refuse_marker)

    with pytest.raises(authorization.RuntimeAuthorizationFailure):
        authorization.consume_once(validated)
    assert validated.evidence_root.is_dir()
    assert validated.evidence_root.stat().st_dev == prepared_identity.st_dev
    assert validated.evidence_root.stat().st_ino == prepared_identity.st_ino
    assert not (validated.evidence_root / authorization.CONSUMPTION_MARKER).exists()


def test_consume_once_cleans_partial_marker_when_descriptor_write_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    validated = _validated(tmp_path)
    prepared_identity = validated.evidence_root.stat()

    def refuse_write(descriptor: int, payload: bytes) -> int:
        raise OSError("synthetic marker write failure")

    monkeypatch.setattr(authorization.os, "write", refuse_write)

    with pytest.raises(authorization.RuntimeAuthorizationFailure):
        authorization.consume_once(validated)
    assert validated.evidence_root.is_dir()
    assert validated.evidence_root.stat().st_dev == prepared_identity.st_dev
    assert validated.evidence_root.stat().st_ino == prepared_identity.st_ino
    assert not (validated.evidence_root / authorization.CONSUMPTION_MARKER).exists()


def test_verify_consumed_rejects_a_relocated_evidence_root(tmp_path: Path) -> None:
    validated = _validated(tmp_path)
    authorization.consume_once(validated)
    replacement = tmp_path / "outside/replacement"
    replacement.mkdir(mode=0o700, parents=True)
    marker = validated.evidence_root / authorization.CONSUMPTION_MARKER
    (replacement / authorization.CONSUMPTION_MARKER).write_text(
        marker.read_text(encoding="utf-8"), encoding="utf-8"
    )
    for path in sorted(validated.evidence_root.iterdir()):
        path.unlink()
    validated.evidence_root.rmdir()
    validated.evidence_root.symlink_to(replacement, target_is_directory=True)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumed(validated)
    assert caught.value.reason == "authorization_consumption_mismatch"


def test_verify_consumed_rejects_a_symlinked_marker(tmp_path: Path) -> None:
    validated = _validated(tmp_path)
    record = authorization.consume_once(validated)
    marker = validated.evidence_root / authorization.CONSUMPTION_MARKER
    elsewhere = tmp_path / "elsewhere.json"
    elsewhere.write_text(json.dumps(record), encoding="utf-8")
    marker.unlink()
    marker.symlink_to(elsewhere)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumed(validated)
    assert caught.value.reason == "authorization_consumption_mismatch"


def test_rollback_marker_check_stays_usable_before_any_consumption(
    tmp_path: Path,
) -> None:
    _, evidence_root = _external_roots(tmp_path)

    assert authorization.verify_consumption_marker(evidence_root) is None


def test_rollback_marker_check_fails_closed_on_an_unmarked_evidence_root(
    tmp_path: Path,
) -> None:
    _, evidence_root = _external_roots(tmp_path)
    evidence_root.mkdir(mode=0o700)
    (evidence_root / "case-n1.json").write_text("{}", encoding="utf-8")

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumption_marker(evidence_root)
    assert caught.value.reason == "authorization_not_consumed"


def test_rollback_marker_check_reads_the_same_marker_without_reconsuming(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    record = authorization.consume_once(validated)

    assert authorization.verify_consumption_marker(validated.evidence_root) == record
    assert authorization.verify_consumed(validated) == record


def test_rollback_marker_check_rejects_a_foreign_authorization_digest(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    authorization.consume_once(validated)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumption_marker(
            validated.evidence_root, expected_authorization_sha256="d" * 64
        )
    assert caught.value.reason == "authorization_consumption_mismatch"


def test_rollback_marker_check_rejects_a_foreign_exact_head_grant_digest(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    authorization.consume_once(validated)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumption_marker(
            validated.evidence_root,
            expected_exact_head_grant_sha256="d" * 64,
        )
    assert caught.value.reason == "authorization_consumption_mismatch"


def test_exact_head_grant_refuses_operator_supplied_digest_without_signature(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = _fixture(tmp_path)
    grant_path = fixture.observed.exact_head_grant_path
    payload = "".join(
        f"{key}={fixture.observed.exact_head_grant[key]}\n"
        for key in authorization.EXACT_HEAD_GRANT_FIELDS
    )
    grant_path.write_text(payload, encoding="utf-8")
    monkeypatch.setenv("CYBRIK_UAT_D2_EXACT_HEAD_GRANT", str(grant_path))
    monkeypatch.setenv(
        "CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SHA256",
        hashlib.sha256(grant_path.read_bytes()).hexdigest(),
    )
    monkeypatch.delenv("CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SIGNATURE", raising=False)
    monkeypatch.delenv("CYBRIK_UAT_D2_EXACT_HEAD_ALLOWED_SIGNERS", raising=False)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._exact_head_grant_from_environment(fixture.fields)
    assert caught.value.reason == "exact_head_grant_signature_invalid"
    assert "CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SHA256" not in inspect.getsource(
        authorization._exact_head_grant_from_environment
    )


def test_exact_head_grant_uses_root_owned_fixed_verifier() -> None:
    verifier = authorization.EXACT_HEAD_GRANT_VERIFY_BINARY
    metadata = verifier.lstat()

    assert verifier == Path("/usr/bin/ssh-keygen")
    assert verifier.resolve(strict=True) == verifier
    assert stat.S_ISREG(metadata.st_mode)
    assert metadata.st_uid == 0
    assert stat.S_IMODE(metadata.st_mode) & 0o022 == 0


def test_rollback_marker_check_rejects_a_foreign_runtime_root(
    tmp_path: Path,
) -> None:
    validated = _validated(tmp_path)
    authorization.consume_once(validated)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.verify_consumption_marker(
            validated.evidence_root,
            expected_runtime_root=tmp_path / "cybrik-uat-d2-runtime-foreign",
        )
    assert caught.value.reason == "authorization_consumption_mismatch"


# --------------------------------------------------------------------------
# Static environment observation and check-only entrypoint
# --------------------------------------------------------------------------


def test_environment_artifact_loader_populates_the_exact_admission_bytes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = _fixture(tmp_path)
    expected = fixture.observed.admission_artifacts
    assert expected is not None
    _install_admission_artifact_environment(tmp_path, monkeypatch, expected)

    loaded = authorization._admission_artifacts_from_environment()

    assert loaded == expected
    validated = authorization.validate_authorization(
        fixture.fields,
        dataclasses.replace(fixture.observed, admission_artifacts=loaded),
    )
    assert validated.coverage is not None
    assert validated.prepared_roots is not None


def test_authorize_from_environment_passes_loaded_artifacts_to_validation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = _fixture(tmp_path)
    expected = fixture.observed.admission_artifacts
    assert expected is not None
    _install_admission_artifact_environment(tmp_path, monkeypatch, expected)
    authorization_path = tmp_path / "authorization.md"
    authorization_path.write_bytes(b"synthetic authorization")
    wheel = tmp_path / "wheel.whl"
    wheel.write_bytes(b"synthetic wheel")
    environment_paths = {
        "CYBRIK_UAT_D2_AUTHORIZATION_PATH": authorization_path,
        "CYBRIK_UAT_D2_B1_WHEEL": wheel,
        "CYBRIK_UAT_D2_RUNTIME_DIR": fixture.runtime_root,
        "CYBRIK_UAT_D2_EVIDENCE_DIR": fixture.evidence_root,
        "CYBRIK_UAT_D2_SOC_REPO": fixture.products["soc"],
        "CYBRIK_UAT_D2_AI_REPO": fixture.products["cyber_ai"],
        "CYBRIK_UAT_D2_FABRIC_REPO": fixture.products["tool_fabric"],
    }
    monkeypatch.setenv("CYBRIK_UAT_D2_EXECUTION_AUTHORIZED", "true")
    monkeypatch.setenv("CYBRIK_UAT_D2_AUTHORIZATION_SHA256", _AUTHORIZATION_SHA)
    for name, path in environment_paths.items():
        monkeypatch.setenv(name, str(path))

    monkeypatch.setattr(authorization, "read_authorization", lambda _: b"authorization")
    monkeypatch.setattr(authorization, "parse_authorization", lambda _: fixture.fields)
    monkeypatch.setattr(
        authorization,
        "_exact_head_grant_from_environment",
        lambda _: (
            fixture.observed.exact_head_grant_path,
            fixture.observed.exact_head_grant,
            fixture.observed.exact_head_grant_sha256,
            fixture.observed.exact_head_grant_signature_path,
            fixture.observed.exact_head_grant_allowed_signers_path,
            fixture.observed.exact_head_grant_allowed_signers_sha256,
            True,
        ),
    )
    monkeypatch.setattr(
        authorization, "_sha256", lambda _: policy.PINNED_B1_WHEEL_SHA256
    )
    monkeypatch.setattr(authorization, "_git", lambda *_args, **_kwargs: "")
    monkeypatch.setattr(
        authorization,
        "_observe_suite",
        lambda *_args: (_SUITE_HEAD, _SUITE_TREE, "", True),
    )
    monkeypatch.setattr(authorization, "_is_git_ancestor", lambda *_args: True)
    monkeypatch.setattr(
        authorization, "runtime_code_aggregate", lambda _: fixture.aggregate
    )
    monkeypatch.setattr(
        authorization, "_candidate", lambda _: fixture.observed.candidate
    )
    observed_states: list[authorization.ObservedRuntimeState] = []
    sentinel = SimpleNamespace()

    def validate(
        _fields: object, observed: authorization.ObservedRuntimeState
    ) -> object:
        observed_states.append(observed)
        return sentinel

    monkeypatch.setattr(authorization, "validate_authorization", validate)
    monkeypatch.setattr(authorization, "resolve_import_source_roots", lambda _: ())

    assert authorization.authorize_from_environment() is sentinel
    assert len(observed_states) == 1
    assert observed_states[0].admission_artifacts == expected


@pytest.mark.parametrize("field_name", tuple(_ADMISSION_ARTIFACT_ENVIRONMENT))
@pytest.mark.parametrize("failure", ("missing", "symlink", "oversize"))
def test_environment_artifact_loader_refuses_unsafe_or_missing_inputs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    field_name: str,
    failure: str,
) -> None:
    fixture = _fixture(tmp_path)
    artifacts = fixture.observed.admission_artifacts
    assert artifacts is not None
    paths = _install_admission_artifact_environment(tmp_path, monkeypatch, artifacts)
    environment_name = _ADMISSION_ARTIFACT_ENVIRONMENT[field_name]
    path = paths[field_name]
    if failure == "missing":
        monkeypatch.delenv(environment_name)
    elif failure == "symlink":
        target = path.with_name(f"{path.name}.target")
        target.write_bytes(path.read_bytes())
        path.unlink()
        path.symlink_to(target)
    else:
        path.write_bytes(b"x" * (64 * 1024 + 1))

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._admission_artifacts_from_environment()
    assert caught.value.reason == "admission_artifact_invalid"


def test_environment_artifact_tamper_is_refused_by_the_signed_digest_binding(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = _fixture(tmp_path)
    artifacts = fixture.observed.admission_artifacts
    assert artifacts is not None
    paths = _install_admission_artifact_environment(tmp_path, monkeypatch, artifacts)
    paths["coverage_authorization_bytes"].write_bytes(
        artifacts.coverage_authorization_bytes + b"\n"
    )
    loaded = authorization._admission_artifacts_from_environment()

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.validate_authorization(
            fixture.fields,
            dataclasses.replace(fixture.observed, admission_artifacts=loaded),
        )
    assert caught.value.reason == authorization.ADMISSION_BINDING_MISMATCH


def test_candidate_observation_reads_the_exact_current_attempt_digest(
    tmp_path: Path,
) -> None:
    candidate = tmp_path / "runtime-admission.json"
    candidate.write_text(
        json.dumps(
            {
                "attempt_accounting": {
                    "current_attempt": {
                        "status": "not_run",
                        "execution_authorized": True,
                        "executed_checks": 0,
                        "passed_checks": 0,
                        "failed_checks": 0,
                        "authorization_sha256": _AUTHORIZATION_SHA,
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    observed = authorization._candidate(candidate)

    assert observed.authorization_sha256 == _AUTHORIZATION_SHA
    assert observed.status == "not_run"
    assert observed.execution_authorized is True


def test_candidate_observation_accepts_only_the_canonical_artifact_fallback(
    tmp_path: Path,
) -> None:
    candidate = tmp_path / "runtime-admission.json"
    candidate.write_text(
        json.dumps(
            {
                "attempt_accounting": {
                    "current_attempt": {
                        "status": "not_run",
                        "execution_authorized": True,
                        "executed_checks": 0,
                        "passed_checks": 0,
                        "failed_checks": 0,
                    }
                },
                "evidence": {
                    "artifacts": [
                        {
                            "path": authorization.AUTHORIZATION_REL.as_posix(),
                            "sha256": _AUTHORIZATION_SHA,
                        }
                    ]
                },
            }
        ),
        encoding="utf-8",
    )

    assert (
        authorization._candidate(candidate).authorization_sha256 == _AUTHORIZATION_SHA
    )


def test_candidate_observer_has_no_dead_authorization_digest_parameter() -> None:
    assert tuple(inspect.signature(authorization._candidate).parameters) == ("path",)


def test_admission_base_is_validated_before_it_can_become_git_argv() -> None:
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._admission_base_for_git({"SUITE_ADMISSION_BASE": "not-a-commit"})
    assert caught.value.reason == "authorization_digest_invalid"


def test_required_absolute_environment_path_is_canonical_and_fail_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("D2_TEST_PATH", raising=False)
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._required_absolute_env("D2_TEST_PATH", existing=False)
    assert caught.value.reason == "runtime_environment_invalid"

    monkeypatch.setenv("D2_TEST_PATH", "relative")
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._required_absolute_env("D2_TEST_PATH", existing=False)
    assert caught.value.reason == "runtime_environment_invalid"

    existing = tmp_path / "existing"
    existing.mkdir()
    monkeypatch.setenv("D2_TEST_PATH", str(existing))
    assert (
        authorization._required_absolute_env("D2_TEST_PATH", existing=True) == existing
    )
    future = tmp_path / "future"
    monkeypatch.setenv("D2_TEST_PATH", str(future))
    assert (
        authorization._required_absolute_env("D2_TEST_PATH", existing=False) == future
    )

    detour = tmp_path / "detour"
    detour.mkdir()
    monkeypatch.setenv("D2_TEST_PATH", str(detour / ".." / existing.name))
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._required_absolute_env("D2_TEST_PATH", existing=True)
    assert caught.value.reason == "runtime_environment_invalid"


def test_candidate_observer_stabilizes_non_mapping_nested_shapes(
    tmp_path: Path,
) -> None:
    candidate = tmp_path / "runtime-admission.json"
    candidate.write_text(
        json.dumps({"attempt_accounting": {"current_attempt": "not-a-mapping"}}),
        encoding="utf-8",
    )

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._candidate(candidate)
    assert caught.value.reason == "candidate_invalid"


@pytest.mark.parametrize(
    "raw",
    (
        b"\xff\n",
        ("[" * 2000 + "0" + "]" * 2000).encode("ascii"),
    ),
)
def test_candidate_observer_stabilizes_decode_and_nesting_failures(
    tmp_path: Path, raw: bytes
) -> None:
    candidate = tmp_path / "runtime-admission.json"
    candidate.write_bytes(raw)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._candidate(candidate)
    assert caught.value.reason == "candidate_invalid"


def test_candidate_observer_stabilizes_oversized_integer_and_recursion(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = tmp_path / "runtime-admission.json"
    candidate.write_text(
        '{"attempt_accounting":{"current_attempt":' + "9" * 5000 + "}}",
        encoding="utf-8",
    )
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._candidate(candidate)
    assert caught.value.reason == "candidate_invalid"

    candidate.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(
        authorization.json,
        "loads",
        lambda _payload: (_ for _ in ()).throw(RecursionError()),
    )
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._candidate(candidate)
    assert caught.value.reason == "candidate_invalid"


def test_candidate_observer_uses_one_bounded_nofollow_descriptor(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = tmp_path / "runtime-admission.json"
    candidate.write_text(
        json.dumps({"attempt_accounting": {"current_attempt": {}}}),
        encoding="utf-8",
    )
    original_open = authorization.os.open
    observed_flags: list[int] = []

    def observe_open(path: Path, flags: int) -> int:
        observed_flags.append(flags)
        return original_open(path, flags)

    monkeypatch.setattr(authorization.os, "open", observe_open)
    monkeypatch.setattr(
        Path,
        "read_text",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("candidate path must not be reopened")
        ),
    )

    assert authorization._candidate(candidate).status is None
    assert len(observed_flags) == 1
    assert observed_flags[0] & getattr(os, "O_NOFOLLOW", 0)


def test_authorization_reader_refuses_oversized_regular_file_before_read(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    document = tmp_path / "authorization.md"
    document.write_bytes(b"small fixture\n")
    original_fstat = authorization.os.fstat

    def oversized(descriptor: int) -> SimpleNamespace:
        observed = original_fstat(descriptor)
        return SimpleNamespace(
            st_mode=observed.st_mode,
            st_nlink=observed.st_nlink,
            st_size=1024 * 1024,
            st_dev=observed.st_dev,
            st_ino=observed.st_ino,
            st_mtime_ns=observed.st_mtime_ns,
            st_ctime_ns=observed.st_ctime_ns,
        )

    monkeypatch.setattr(authorization.os, "fstat", oversized)
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.read_authorization(document)
    assert caught.value.reason == "authorization_artifact_invalid"


def test_bound_reader_refuses_hardlinks_and_candidate_size_overflow(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    document = tmp_path / "authorization.md"
    document.write_bytes(b"small fixture\n")
    alias = tmp_path / "authorization-alias.md"
    os.link(document, alias)
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.read_authorization(document)
    assert caught.value.reason == "authorization_artifact_invalid"
    alias.unlink()

    original_fstat = authorization.os.fstat

    def oversized(descriptor: int) -> SimpleNamespace:
        observed = original_fstat(descriptor)
        return SimpleNamespace(
            st_mode=observed.st_mode,
            st_nlink=1,
            st_size=authorization.MAX_CANDIDATE_BYTES + 1,
            st_dev=observed.st_dev,
            st_ino=observed.st_ino,
            st_mtime_ns=observed.st_mtime_ns,
            st_ctime_ns=observed.st_ctime_ns,
        )

    monkeypatch.setattr(authorization.os, "fstat", oversized)
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._candidate(document)
    assert caught.value.reason == "candidate_invalid"


def test_bound_reader_refuses_post_read_identity_change(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    document = tmp_path / "authorization.md"
    document.write_bytes(b"small fixture\n")
    original_fstat = authorization.os.fstat
    observations = 0

    def changed(descriptor: int) -> os.stat_result | SimpleNamespace:
        nonlocal observations
        observed = original_fstat(descriptor)
        observations += 1
        if observations == 1:
            return observed
        return SimpleNamespace(
            st_mode=observed.st_mode,
            st_nlink=observed.st_nlink,
            st_size=observed.st_size,
            st_dev=observed.st_dev,
            st_ino=observed.st_ino,
            st_mtime_ns=observed.st_mtime_ns,
            st_ctime_ns=observed.st_ctime_ns + 1,
        )

    monkeypatch.setattr(authorization.os, "fstat", changed)
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.read_authorization(document)
    assert caught.value.reason == "authorization_artifact_invalid"


def test_bound_reader_refuses_a_short_read(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    document = tmp_path / "authorization.md"
    document.write_bytes(b"small fixture\n")
    monkeypatch.setattr(authorization.os, "read", lambda *_args: b"")

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization.read_authorization(document)
    assert caught.value.reason == "authorization_artifact_invalid"


def test_merge_base_observation_stabilizes_process_failures(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*_args: object, **_kwargs: object) -> object:
        raise subprocess.TimeoutExpired(("git", "merge-base"), 30)

    monkeypatch.setattr(authorization.subprocess, "run", fail)

    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._is_git_ancestor(tmp_path, "a" * 40, "b" * 40)
    assert caught.value.reason == "repository_observation_failed"


def test_git_observers_use_a_minimal_environment_and_strict_statuses(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[dict[str, object]] = []
    return_codes = iter((0, 1, 128))

    def observe(*_args: object, **kwargs: object) -> SimpleNamespace:
        calls.append(dict(kwargs))
        return SimpleNamespace(returncode=next(return_codes), stdout="")

    monkeypatch.setattr(authorization.subprocess, "run", observe)
    assert authorization._git(tmp_path, "rev-parse", "HEAD") == ""
    assert not authorization._is_git_ancestor(tmp_path, "a" * 40, "b" * 40)
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        authorization._is_git_ancestor(tmp_path, "a" * 40, "b" * 40)
    assert caught.value.reason == "repository_observation_failed"
    for call in calls:
        assert call["env"] == {
            "GIT_CONFIG_GLOBAL": "/dev/null",
            "GIT_CONFIG_NOSYSTEM": "1",
            "LC_ALL": "C",
            "PATH": "/usr/bin:/bin",
        }


def test_suite_observer_reuses_the_resolved_head_for_ancestry(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    resolved_head = "c" * 40
    resolved_tree = "d" * 40
    descendants: list[str] = []

    def observe_git(_root: Path, *args: str, allow_status: bool = False) -> str:
        del allow_status
        if args == ("rev-parse", "HEAD"):
            return resolved_head
        if args == ("rev-parse", f"{resolved_head}^{{tree}}"):
            return resolved_tree
        if args[0] == "status":
            return ""
        raise AssertionError(args)

    def observe_ancestor(_root: Path, _ancestor: str, descendant: str) -> bool:
        descendants.append(descendant)
        return True

    monkeypatch.setattr(authorization, "_git", observe_git)
    monkeypatch.setattr(authorization, "_is_git_ancestor", observe_ancestor)

    assert authorization._observe_suite(tmp_path, "b" * 40) == (
        resolved_head,
        resolved_tree,
        "",
        True,
    )
    assert descendants == [resolved_head]


def test_non_ascii_allowed_signers_refusal_closes_the_bound_descriptor(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fixture = _fixture(tmp_path)
    allowed_signers = fixture.observed.exact_head_grant_allowed_signers_path
    allowed_signers.write_bytes(b"\xff\n")
    monkeypatch.setenv(
        "CYBRIK_UAT_D2_EXACT_HEAD_GRANT",
        str(fixture.observed.exact_head_grant_path),
    )
    monkeypatch.setenv(
        "CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SIGNATURE",
        str(fixture.observed.exact_head_grant_signature_path),
    )
    monkeypatch.setenv("CYBRIK_UAT_D2_EXACT_HEAD_ALLOWED_SIGNERS", str(allowed_signers))
    opened: list[int] = []
    closed: set[int] = set()
    original_open = authorization._open_bound_allowed_signers
    original_close = os.close

    def observe(path: Path) -> tuple[int, bytes, tuple[int, ...]]:
        result = original_open(path)
        opened.append(result[0])
        return result

    def close(descriptor: int) -> None:
        closed.add(descriptor)
        original_close(descriptor)

    monkeypatch.setattr(authorization, "_open_bound_allowed_signers", observe)
    monkeypatch.setattr(authorization.os, "close", close)
    try:
        with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
            authorization._exact_head_grant_from_environment(fixture.fields)
        assert caught.value.reason == "exact_head_grant_signer_mismatch"
        assert opened and opened[0] in closed
    finally:
        for descriptor in opened:
            if descriptor not in closed:
                original_close(descriptor)


def test_check_only_cli_validates_without_consuming(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []
    monkeypatch.setattr(
        authorization,
        "authorize_from_environment",
        lambda: calls.append("validate"),
    )
    monkeypatch.setattr(
        authorization,
        "consume_once",
        lambda _: (_ for _ in ()).throw(AssertionError("must not consume")),
    )

    assert authorization.main(["--check-only"]) == 0
    assert calls == ["validate"]


def test_check_only_cli_emits_only_a_stable_reason_for_known_refusals(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def refuse() -> object:
        raise authorization.RuntimeAuthorizationFailure("candidate_closed")

    monkeypatch.setattr(authorization, "authorize_from_environment", refuse)

    assert authorization.main(["--check-only"]) == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == "D2 runtime authorization refused: candidate_closed\n"
