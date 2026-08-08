"""RED contracts for the authenticated coverage and prepared-root admission chain.

All artifacts in this module are small canonical JSON fixtures below ``tmp_path``
or in memory.  The tests do not invoke Git, OpenSSH, Coverage.py, Docker, a
listener, a product process, or the network.

The coverage verifier is intentionally not the authority boundary.  A PASS can
become runtime-admissible only when the already signature-verified exact-head
grant pins the exact coverage authorization, measurement receipt, PASS result,
Suite source tuple, and root-preparation receipt.
"""

from __future__ import annotations

import copy
import dataclasses
import hashlib
import importlib.util
import inspect
import json
import sys
from collections.abc import Mapping
from pathlib import Path

import pytest
from cybrik_suite_uat_mtls import runtime_authorization as authorization

_RUNTIME_AUTHORIZATION_SHA256 = "a" * 64
_SUITE_COMMIT = "c" * 40
_SUITE_TREE = "d" * 40
_PRODUCER_SHA256 = "e" * 64
_WRAPPER_SHA256 = "f" * 64
_COMMAND_SHA256 = "1" * 64
_COVERAGE_AUTHORIZATION_ID = "d2-coverage-auth-final"
_RUNTIME_AUTHORIZATION_ID = "d2-runtime-auth-final"


_GATE_FIXTURE_PATH = Path(__file__).with_name("test_coverage_gate.py")


def _load_gate_fixtures() -> object:
    """Load the coverage-gate fixtures without importing them as a test module."""

    spec = importlib.util.spec_from_file_location(
        "d2_admission_gate_fixtures", _GATE_FIXTURE_PATH
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


GATE = _load_gate_fixtures()


def _canonical_bytes(value: Mapping[str, object]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _directory(
    path: str,
    device: int,
    inode: int,
    inventory: tuple[str, ...] = (),
) -> dict[str, object]:
    return {
        "identity": {
            "mode": "0700",
            "st_dev": device,
            "st_ino": inode,
            "uid": 501,
        },
        "inventory": list(inventory),
        "path": path,
    }


def _artifacts() -> dict[str, object]:
    coverage_authorization: dict[str, object] = {
        "authorization_id": _COVERAGE_AUTHORIZATION_ID,
        "measurement_command_sha256": _COMMAND_SHA256,
        "measurement_wrapper_sha256": _WRAPPER_SHA256,
        "pinned_python_sha256": _PRODUCER_SHA256,
        "receipt_policy_id": "cybrik-d2-coverage-receipt/v2",
        "suite_commit": _SUITE_COMMIT,
        "suite_tree": _SUITE_TREE,
    }
    coverage_authorization_bytes = _canonical_bytes(coverage_authorization)
    coverage_authorization_sha256 = _sha256(coverage_authorization_bytes)
    receipt: dict[str, object] = {
        "artifacts": {
            "coverage_data_sha256": "2" * 64,
            "coverage_json_sha256": "3" * 64,
        },
        "authorization": {
            "id": _COVERAGE_AUTHORIZATION_ID,
            "sha256": coverage_authorization_sha256,
        },
        "execution_boundary": {"network_calls": [], "runtime_executed": False},
        "producer": {
            "executable_sha256": _PRODUCER_SHA256,
            "identity": "cybrik-d2-coverage-wrapper",
            "wrapper_sha256": _WRAPPER_SHA256,
        },
        "receipt_id": "coverage-run-final-receipt",
        "run": {
            "command_sha256": _COMMAND_SHA256,
            "id": "coverage-run-final",
            "nonce": "4" * 64,
        },
        "schema_version": "2.0.0",
        "source": {"suite_commit": _SUITE_COMMIT, "suite_tree": _SUITE_TREE},
    }
    receipt_bytes = _canonical_bytes(receipt)
    pass_result: dict[str, object] = {
        "binding": {
            "coverage_authorization_sha256": coverage_authorization_sha256,
            "measurement_receipt_sha256": _sha256(receipt_bytes),
            "suite_commit": _SUITE_COMMIT,
            "suite_tree": _SUITE_TREE,
        },
        "branch": {"covered": 12, "ratio": 1.0, "total": 12},
        "line": {"covered": 68, "ratio": 1.0, "total": 68},
        "status": "PASS",
    }
    pass_result_bytes = _canonical_bytes(pass_result)
    root_preparation: dict[str, object] = {
        "authorization_id": _RUNTIME_AUTHORIZATION_ID,
        "authorization_sha256": _RUNTIME_AUTHORIZATION_SHA256,
        "roots": {
            "evidence": _directory("/state/cybrik-uat-d2-evidence-final", 10, 102),
            "pki": _directory("/state/cybrik-uat-d2-runtime-final/pki", 10, 103),
            "runtime": _directory(
                "/state/cybrik-uat-d2-runtime-final", 10, 101, ("pki",)
            ),
        },
        "schema_version": "CYBRIK-D2-ROOT-PREPARATION/v1",
        "source": {"suite_commit": _SUITE_COMMIT, "suite_tree": _SUITE_TREE},
    }
    root_preparation_bytes = _canonical_bytes(root_preparation)
    exact_head_grant: dict[str, str] = {
        "AUTHORIZATION_SHA256": _RUNTIME_AUTHORIZATION_SHA256,
        "AUTHORIZED_BY": "CODEX-GOVERNOR",
        "COVERAGE_AUTHORIZATION_SHA256": coverage_authorization_sha256,
        "COVERAGE_GATE_RESULT_SHA256": _sha256(pass_result_bytes),
        "COVERAGE_MEASUREMENT_RECEIPT_SHA256": _sha256(receipt_bytes),
        "D2_EXACT_HEAD_GRANT": "APPROVE",
        "GRANT_VERSION": "CYBRIK-D2-EXACT-HEAD-GRANT/v2",
        "ROOT_PREPARATION_RECEIPT_SHA256": _sha256(root_preparation_bytes),
        "RUNTIME_CODE_AGGREGATE_SHA256": "5" * 64,
        "SUITE_HEAD": _SUITE_COMMIT,
        "SUITE_TREE": _SUITE_TREE,
    }
    return {
        "coverage_authorization": coverage_authorization,
        "coverage_authorization_bytes": coverage_authorization_bytes,
        "exact_head_grant": exact_head_grant,
        "pass_result": pass_result,
        "pass_result_bytes": pass_result_bytes,
        "receipt": receipt,
        "receipt_bytes": receipt_bytes,
        "root_preparation": root_preparation,
        "root_preparation_bytes": root_preparation_bytes,
    }


def _validate(bundle: Mapping[str, object]) -> object:
    """Exercise the future pure validator after signature verification."""

    return authorization.validate_admission_artifacts(
        exact_head_grant=bundle["exact_head_grant"],
        runtime_authorization_id=_RUNTIME_AUTHORIZATION_ID,
        runtime_authorization_sha256=_RUNTIME_AUTHORIZATION_SHA256,
        observed_suite_commit=_SUITE_COMMIT,
        observed_suite_tree=_SUITE_TREE,
        coverage_authorization_bytes=bundle["coverage_authorization_bytes"],
        measurement_receipt_bytes=bundle["receipt_bytes"],
        coverage_pass_result_bytes=bundle["pass_result_bytes"],
        root_preparation_receipt_bytes=bundle["root_preparation_bytes"],
    )


def _repin_preparation(
    bundle: dict[str, object], preparation: Mapping[str, object]
) -> None:
    """Re-pin the grant to mutated preparation bytes.

    A grant that pins the exact mutated bytes cannot turn a receipt that
    contradicts the required prepared-root contract into an admitted tuple.
    """

    preparation_bytes = _canonical_bytes(preparation)
    bundle["root_preparation_bytes"] = preparation_bytes
    grant = bundle["exact_head_grant"]
    assert isinstance(grant, dict)
    grant["ROOT_PREPARATION_RECEIPT_SHA256"] = _sha256(preparation_bytes)


def _mutated_preparation(bundle: dict[str, object]) -> dict[str, object]:
    preparation = copy.deepcopy(bundle["root_preparation"])
    assert isinstance(preparation, dict)
    return preparation


def _roots(preparation: Mapping[str, object]) -> dict[str, object]:
    roots = preparation["roots"]
    assert isinstance(roots, dict)
    return roots


def _assert_refused(bundle: Mapping[str, object]) -> None:
    with pytest.raises(authorization.RuntimeAuthorizationFailure) as caught:
        _validate(bundle)
    assert caught.value.reason == "admission_artifact_binding_mismatch"


def test_signed_exact_head_grant_v2_covers_every_post_commit_admission_digest() -> None:
    required = {
        "SUITE_HEAD",
        "SUITE_TREE",
        "AUTHORIZATION_SHA256",
        "COVERAGE_AUTHORIZATION_SHA256",
        "COVERAGE_MEASUREMENT_RECEIPT_SHA256",
        "COVERAGE_GATE_RESULT_SHA256",
        "ROOT_PREPARATION_RECEIPT_SHA256",
        "RUNTIME_CODE_AGGREGATE_SHA256",
    }

    assert authorization.EXACT_HEAD_GRANT_VERSION == ("CYBRIK-D2-EXACT-HEAD-GRANT/v2")
    assert required <= set(authorization.EXACT_HEAD_GRANT_FIELDS)


def test_runtime_authorization_carries_immutable_coverage_and_root_bindings() -> None:
    runtime_fields = {
        field.name for field in dataclasses.fields(authorization.RuntimeAuthorization)
    }

    assert {"coverage", "prepared_roots"} <= runtime_fields
    assert "consumption_receipt_path" not in runtime_fields
    assert dataclasses.is_dataclass(authorization.CoverageAdmission)
    assert dataclasses.is_dataclass(authorization.PreparedRoots)
    assert dataclasses.is_dataclass(authorization.DirectoryIdentity)
    assert dataclasses.is_dataclass(authorization.RootBinding)


def test_admission_api_hashes_canonical_coverage_authorization_bytes_itself() -> None:
    api_fields = set(
        inspect.signature(authorization.validate_admission_artifacts).parameters
    )
    artifact_fields = {
        field.name for field in dataclasses.fields(authorization.AdmissionArtifacts)
    }

    assert "coverage_authorization_bytes" in api_fields
    assert "coverage_authorization" not in api_fields
    assert "coverage_authorization_sha256" not in api_fields
    assert "coverage_authorization_bytes" in artifact_fields
    assert "coverage_authorization" not in artifact_fields
    assert "coverage_authorization_sha256" not in artifact_fields


def test_exact_signed_artifact_chain_produces_one_admission_binding() -> None:
    admitted = _validate(_artifacts())

    assert isinstance(admitted, authorization.AdmissionBinding)
    assert admitted.coverage.source_commit == _SUITE_COMMIT
    assert admitted.coverage.source_tree == _SUITE_TREE
    assert admitted.prepared_roots.pki.identity.st_ino == 103


def test_same_call_forged_receipt_digest_cannot_replace_the_grant_pinned_receipt() -> (
    None
):
    bundle = _artifacts()
    forged_receipt = copy.deepcopy(bundle["receipt"])
    assert isinstance(forged_receipt, dict)
    producer = forged_receipt["producer"]
    assert isinstance(producer, dict)
    producer["executable_sha256"] = "9" * 64
    forged_bytes = _canonical_bytes(forged_receipt)
    assert (
        _sha256(forged_bytes)
        != bundle["exact_head_grant"]["COVERAGE_MEASUREMENT_RECEIPT_SHA256"]
    )
    bundle["receipt_bytes"] = forged_bytes

    _assert_refused(bundle)


def test_caller_supplied_coverage_authorization_digest_cannot_replace_local_hashing() -> (
    None
):
    bundle = _artifacts()
    forged_authorization = copy.deepcopy(bundle["coverage_authorization"])
    assert isinstance(forged_authorization, dict)
    forged_authorization["measurement_command_sha256"] = "9" * 64
    forged_bytes = _canonical_bytes(forged_authorization)
    grant = bundle["exact_head_grant"]
    assert isinstance(grant, dict)
    assert _sha256(forged_bytes) != grant["COVERAGE_AUTHORIZATION_SHA256"]
    bundle["coverage_authorization_bytes"] = forged_bytes

    _assert_refused(bundle)


def test_semantically_equal_noncanonical_coverage_authorization_bytes_are_refused() -> (
    None
):
    bundle = _artifacts()
    coverage_authorization = bundle["coverage_authorization"]
    assert isinstance(coverage_authorization, dict)
    noncanonical = json.dumps(coverage_authorization, indent=2).encode("utf-8")
    grant = bundle["exact_head_grant"]
    assert isinstance(grant, dict)
    grant["COVERAGE_AUTHORIZATION_SHA256"] = _sha256(noncanonical)
    receipt = copy.deepcopy(bundle["receipt"])
    assert isinstance(receipt, dict)
    receipt_authorization = receipt["authorization"]
    assert isinstance(receipt_authorization, dict)
    receipt_authorization["sha256"] = _sha256(noncanonical)
    receipt_bytes = _canonical_bytes(receipt)
    grant["COVERAGE_MEASUREMENT_RECEIPT_SHA256"] = _sha256(receipt_bytes)
    bundle["coverage_authorization_bytes"] = noncanonical
    bundle["receipt_bytes"] = receipt_bytes

    _assert_refused(bundle)


def test_receipt_and_pass_result_from_different_runs_cannot_be_swapped() -> None:
    first = _artifacts()
    second = _artifacts()
    second_receipt = copy.deepcopy(second["receipt"])
    assert isinstance(second_receipt, dict)
    run = second_receipt["run"]
    assert isinstance(run, dict)
    run["id"] = "coverage-run-other"
    second_receipt_bytes = _canonical_bytes(second_receipt)
    second_result = copy.deepcopy(second["pass_result"])
    assert isinstance(second_result, dict)
    binding = second_result["binding"]
    assert isinstance(binding, dict)
    binding["measurement_receipt_sha256"] = _sha256(second_receipt_bytes)
    second_result_bytes = _canonical_bytes(second_result)
    second["receipt_bytes"] = second_receipt_bytes
    second["pass_result_bytes"] = second_result_bytes

    first["receipt_bytes"] = second["receipt_bytes"]
    _assert_refused(first)

    first = _artifacts()
    first["pass_result_bytes"] = second["pass_result_bytes"]
    _assert_refused(first)


@pytest.mark.parametrize("mismatch", ("commit", "tree", "authorization_id"))
def test_receipt_source_tuple_and_coverage_authorization_id_are_not_claims_only(
    mismatch: str,
) -> None:
    bundle = _artifacts()
    receipt = copy.deepcopy(bundle["receipt"])
    assert isinstance(receipt, dict)
    if mismatch == "authorization_id":
        receipt_authorization = receipt["authorization"]
        assert isinstance(receipt_authorization, dict)
        receipt_authorization["id"] = "caller-selected-authorization"
    else:
        source = receipt["source"]
        assert isinstance(source, dict)
        source[f"suite_{mismatch}"] = "8" * 40
    receipt_bytes = _canonical_bytes(receipt)
    bundle["receipt_bytes"] = receipt_bytes
    grant = bundle["exact_head_grant"]
    assert isinstance(grant, dict)
    # Even a grant that pins these exact receipt bytes cannot turn contradictory
    # source/auth claims into an admitted runtime tuple.
    grant["COVERAGE_MEASUREMENT_RECEIPT_SHA256"] = _sha256(receipt_bytes)

    _assert_refused(bundle)


def test_pass_result_must_repeat_the_exact_receipt_and_source_tuple() -> None:
    bundle = _artifacts()
    result = copy.deepcopy(bundle["pass_result"])
    assert isinstance(result, dict)
    result_binding = result["binding"]
    assert isinstance(result_binding, dict)
    result_binding["measurement_receipt_sha256"] = "7" * 64
    result_bytes = _canonical_bytes(result)
    bundle["pass_result_bytes"] = result_bytes
    grant = bundle["exact_head_grant"]
    assert isinstance(grant, dict)
    grant["COVERAGE_GATE_RESULT_SHA256"] = _sha256(result_bytes)

    _assert_refused(bundle)


@pytest.mark.parametrize("missing_identity", ("st_dev", "st_ino", "uid", "mode"))
def test_root_preparation_receipt_requires_every_signed_directory_identity_field(
    missing_identity: str,
) -> None:
    bundle = _artifacts()
    preparation = _mutated_preparation(bundle)
    pki_root = _roots(preparation)["pki"]
    assert isinstance(pki_root, dict)
    identity = pki_root["identity"]
    assert isinstance(identity, dict)
    identity.pop(missing_identity)
    _repin_preparation(bundle, preparation)

    _assert_refused(bundle)


def test_signed_root_preparation_declares_the_exact_initial_inventory() -> None:
    """The one-shot roots start as: runtime holds only pki, the rest are empty."""

    assert authorization.PREPARED_PKI_LEAF == "pki"
    assert dict(authorization.PREPARED_ROOT_INITIAL_INVENTORY) == {
        "evidence": (),
        "pki": (),
        "runtime": ("pki",),
    }
    assert tuple(authorization.PREPARED_ROOT_INITIAL_INVENTORY) == (
        authorization.PREPARED_ROOT_ROLES
    )


def test_admitted_prepared_roots_carry_the_signed_initial_inventory() -> None:
    admitted = _validate(_artifacts())

    assert isinstance(admitted, authorization.AdmissionBinding)
    assert admitted.prepared_roots.runtime.inventory == ("pki",)
    assert admitted.prepared_roots.evidence.inventory == ()
    assert admitted.prepared_roots.pki.inventory == ()


@pytest.mark.parametrize(
    ("role", "inventory"),
    (
        ("runtime", []),
        ("runtime", ["extra", "pki"]),
        ("runtime", ["postgres-password"]),
        ("evidence", [".cybrik-d2-runtime-consumed.json"]),
        ("pki", ["ca-cert.pem"]),
    ),
)
def test_root_preparation_receipt_requires_the_exact_initial_inventory(
    role: str, inventory: list[str]
) -> None:
    """A receipt that declares a used or understated root is never admissible."""

    bundle = _artifacts()
    preparation = _mutated_preparation(bundle)
    declared = _roots(preparation)[role]
    assert isinstance(declared, dict)
    declared["inventory"] = inventory
    _repin_preparation(bundle, preparation)

    _assert_refused(bundle)


def test_root_preparation_receipt_requires_pki_to_be_the_runtime_pki_leaf() -> None:
    """Only the exact ``<runtime>/pki`` child can carry the signed PKI identity."""

    bundle = _artifacts()
    preparation = _mutated_preparation(bundle)
    pki_root = _roots(preparation)["pki"]
    assert isinstance(pki_root, dict)
    pki_root["path"] = "/state/cybrik-uat-d2-runtime-final/pki-alternate"
    _repin_preparation(bundle, preparation)

    _assert_refused(bundle)


def test_root_preparation_receipt_requires_one_owning_uid_and_mode() -> None:
    bundle = _artifacts()
    preparation = _mutated_preparation(bundle)
    evidence_root = _roots(preparation)["evidence"]
    assert isinstance(evidence_root, dict)
    identity = evidence_root["identity"]
    assert isinstance(identity, dict)
    identity["uid"] = 502
    _repin_preparation(bundle, preparation)

    _assert_refused(bundle)


def test_non_pass_coverage_result_is_never_runtime_admissible_even_when_digest_pinned() -> (
    None
):
    bundle = _artifacts()
    result = copy.deepcopy(bundle["pass_result"])
    assert isinstance(result, dict)
    result["status"] = "FAIL"
    result_bytes = _canonical_bytes(result)
    bundle["pass_result_bytes"] = result_bytes
    grant = bundle["exact_head_grant"]
    assert isinstance(grant, dict)
    grant["COVERAGE_GATE_RESULT_SHA256"] = _sha256(result_bytes)

    _assert_refused(bundle)


# --------------------------------------------------------------------------
# Interoperability: the real verifier's own bytes must satisfy this admission
# layer.  These tests run the stdlib-only verifier as a subprocess over a
# synthetic fixture tree below ``tmp_path``.  They do not run Coverage.py, the
# UAT harness, Git, OpenSSH, Docker, a listener or the network.
# --------------------------------------------------------------------------


def _gate_bundle(tmp_path: Path) -> dict[str, object]:
    """Produce a real verifier PASS and wrap it in a matching signed grant."""

    suite_root, report_path, _ = GATE._fixture(tmp_path)
    completed = GATE._run(suite_root, report_path)
    assert completed.returncode == 0, completed.stderr
    return _bundle_for_gate_result(
        report_path, report_path.with_name("coverage-gate.json").read_bytes()
    )


def _bundle_for_gate_result(
    report_path: Path, result_bytes: bytes
) -> dict[str, object]:
    coverage_authorization_bytes = report_path.with_name(
        "coverage-authorization.json"
    ).read_bytes()
    receipt_bytes = report_path.with_name("measurement-receipt.json").read_bytes()
    root_preparation: dict[str, object] = {
        "authorization_id": _RUNTIME_AUTHORIZATION_ID,
        "authorization_sha256": _RUNTIME_AUTHORIZATION_SHA256,
        "roots": {
            "evidence": _directory("/state/cybrik-uat-d2-evidence-gate", 10, 202),
            "pki": _directory("/state/cybrik-uat-d2-runtime-gate/pki", 10, 203),
            "runtime": _directory(
                "/state/cybrik-uat-d2-runtime-gate", 10, 201, ("pki",)
            ),
        },
        "schema_version": "CYBRIK-D2-ROOT-PREPARATION/v1",
        "source": {"suite_commit": GATE.SUITE_COMMIT, "suite_tree": GATE.SUITE_TREE},
    }
    root_preparation_bytes = _canonical_bytes(root_preparation)
    return {
        "coverage_authorization_bytes": coverage_authorization_bytes,
        "receipt_bytes": receipt_bytes,
        "pass_result_bytes": result_bytes,
        "root_preparation_bytes": root_preparation_bytes,
        "exact_head_grant": {
            "AUTHORIZATION_SHA256": _RUNTIME_AUTHORIZATION_SHA256,
            "AUTHORIZED_BY": "CODEX-GOVERNOR",
            "COVERAGE_AUTHORIZATION_SHA256": _sha256(coverage_authorization_bytes),
            "COVERAGE_GATE_RESULT_SHA256": _sha256(result_bytes),
            "COVERAGE_MEASUREMENT_RECEIPT_SHA256": _sha256(receipt_bytes),
            "D2_EXACT_HEAD_GRANT": "APPROVE",
            "GRANT_VERSION": "CYBRIK-D2-EXACT-HEAD-GRANT/v2",
            "ROOT_PREPARATION_RECEIPT_SHA256": _sha256(root_preparation_bytes),
            "RUNTIME_CODE_AGGREGATE_SHA256": "5" * 64,
            "SUITE_HEAD": GATE.SUITE_COMMIT,
            "SUITE_TREE": GATE.SUITE_TREE,
        },
    }


def test_verifier_pass_and_receipt_are_admitted_by_the_runtime_admission_layer(
    tmp_path: Path,
) -> None:
    bundle = _gate_bundle(tmp_path)

    admitted = _validate(bundle)

    assert isinstance(admitted, authorization.AdmissionBinding)
    assert admitted.coverage.authorization_id == GATE.COVERAGE_AUTHORIZATION_ID
    assert admitted.coverage.authorization_sha256 == _sha256(
        bundle["coverage_authorization_bytes"]
    )
    assert admitted.coverage.measurement_receipt_sha256 == _sha256(
        bundle["receipt_bytes"]
    )
    assert admitted.coverage.result_sha256 == _sha256(bundle["pass_result_bytes"])
    assert admitted.coverage.run_id == "d2-coverage-test-run-0001"
    assert admitted.coverage.source_commit == GATE.SUITE_COMMIT
    assert admitted.coverage.source_tree == GATE.SUITE_TREE


def test_verifier_result_bytes_are_exactly_the_admitted_canonical_object(
    tmp_path: Path,
) -> None:
    bundle = _gate_bundle(tmp_path)
    result_bytes = bundle["pass_result_bytes"]
    assert isinstance(result_bytes, bytes)

    admitted_result = authorization._admitted_canonical_object(result_bytes)

    assert set(admitted_result) == set(authorization._COVERAGE_RESULT_KEYS)
    assert admitted_result["status"] == authorization.COVERAGE_ADMISSIBLE_STATUS
    assert set(admitted_result["binding"]) == set(
        authorization._COVERAGE_RESULT_BINDING_KEYS
    )


def test_verifier_receipt_bytes_are_exactly_the_admitted_v2_receipt(
    tmp_path: Path,
) -> None:
    bundle = _gate_bundle(tmp_path)
    receipt_bytes = bundle["receipt_bytes"]
    coverage_authorization_bytes = bundle["coverage_authorization_bytes"]
    assert isinstance(receipt_bytes, bytes)
    assert isinstance(coverage_authorization_bytes, bytes)

    admitted_receipt = authorization._admitted_canonical_object(receipt_bytes)
    admitted_authorization = authorization._admitted_canonical_object(
        coverage_authorization_bytes
    )

    assert set(admitted_receipt) == set(authorization._MEASUREMENT_RECEIPT_KEYS)
    assert (
        admitted_receipt["schema_version"]
        == authorization.COVERAGE_MEASUREMENT_RECEIPT_SCHEMA
    )
    assert set(admitted_authorization) == set(
        authorization._COVERAGE_AUTHORIZATION_KEYS
    )
    assert (
        admitted_authorization["receipt_policy_id"]
        == authorization.COVERAGE_RECEIPT_POLICY_ID
    )


def test_verifier_fail_result_is_never_admitted_even_when_the_grant_pins_it(
    tmp_path: Path,
) -> None:
    suite_root, report_path, report = GATE._fixture(tmp_path)
    meta = report["meta"]
    assert isinstance(meta, dict)
    meta["version"] = "7.15.1"
    GATE._rewrite(report_path, report)
    completed = GATE._run(suite_root, report_path)
    assert completed.returncode == 2
    result_bytes = report_path.with_name("coverage-gate.json").read_bytes()

    _assert_refused(_bundle_for_gate_result(report_path, result_bytes))
