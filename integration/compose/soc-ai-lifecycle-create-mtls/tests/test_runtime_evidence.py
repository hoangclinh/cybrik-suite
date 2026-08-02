"""Pure unit contract for immutable D2 Phase-B terminal evidence."""

from __future__ import annotations

import copy
import hashlib
import json
import os
import stat
from pathlib import Path
from typing import NoReturn, get_type_hints

import pytest

from cybrik_suite_uat_mtls import runtime_evidence

HEX40 = "1" * 40
HEX64 = "a" * 64
PKI_PUBLIC_PATHS = (
    ("ca_certificate", "pki-public/ca-cert.pem"),
    ("server_certificate", "pki-public/server-cert.pem"),
    ("client_certificate", "pki-public/client-cert.pem"),
    ("alternate_client_certificate", "pki-public/alternate-client-cert.pem"),
    ("jwt_public_jwk", "pki-public/jwt-public-jwk.json"),
)
PUBLIC_TEST_CERTIFICATE = b"""-----BEGIN CERTIFICATE-----
MIICGTCCAZ+gAwIBAgIQCeCTZaz32ci5PhwLBCou8zAKBggqhkjOPQQDAzBOMQsw
CQYDVQQGEwJVUzEXMBUGA1UEChMORGlnaUNlcnQsIEluYy4xJjAkBgNVBAMTHURp
Z2lDZXJ0IFRMUyBFQ0MgUDM4NCBSb290IEc1MB4XDTIxMDExNTAwMDAwMFoXDTQ2
MDExNDIzNTk1OVowTjELMAkGA1UEBhMCVVMxFzAVBgNVBAoTDkRpZ2lDZXJ0LCBJ
bmMuMSYwJAYDVQQDEx1EaWdpQ2VydCBUTFMgRUNDIFAzODQgUm9vdCBHNTB2MBAG
ByqGSM49AgEGBSuBBAAiA2IABMFEoc8Rl1Ca3iOCNQfN0MsYndLxf3c1TzvdlHJS
7cI7+Oz6e2tYIOyZrsn8aLN1udsJ7MgT9U7GCh1mMEy7H0cKPGEQQil8pQgO4CLp
0zVozptjn4S1mU1YoI71VOeVyaNCMEAwHQYDVR0OBBYEFMFRRVBZqz7nLFr6ICIS
B4CIfBFqMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49
BAMDA2gAMGUCMQCJao1H5+z8blUD2WdsJk6Dxv3J+ysTvLd6jLRl0mlpYxNjOyZQ
LgGheQaRnUi/wr4CMEfDFXuxoJGZSZOoPHzoRgaLLPIxAJSdYsiJvRmEFOml+wG4
DXZDjC5Ty3zfDBeWUA==
-----END CERTIFICATE-----
"""


def _public_certificate(label: str) -> bytes:
    assert label
    return PUBLIC_TEST_CERTIFICATE


def _write_public_pki(root: Path) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for name, relative_path in PKI_PUBLIC_PATHS:
        if name == "jwt_public_jwk":
            payload = (
                json.dumps(
                    {
                        "keys": [
                            {
                                "alg": "ES256",
                                "crv": "P-256",
                                "kid": "d2-public-key",
                                "kty": "EC",
                                "x": "A" * 43,
                                "y": "B" * 43,
                            }
                        ]
                    },
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode()
                + b"\n"
            )
        else:
            payload = _public_certificate(name)
        path = root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
        records.append(
            {
                "name": name,
                "relative_path": relative_path,
                "sha256": hashlib.sha256(payload).hexdigest(),
                "size_bytes": len(payload),
            }
        )
    return records


def _write_artifact(
    root: Path, relative_path: str, payload: bytes
) -> dict[str, object]:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return {
        "name": relative_path.removesuffix(".json").replace("/", "-"),
        "kind": "case",
        "case_id": relative_path.removeprefix("case-").removesuffix(".json").upper(),
        "relative_path": relative_path,
        "sha256": hashlib.sha256(payload).hexdigest(),
        "size_bytes": len(payload),
    }


def _passing_candidate(root: Path) -> dict[str, object]:
    public_pki = _write_public_pki(root)
    artifacts = [
        _write_artifact(root, f"case-n{number}.json", b'{"passed":true}\n')
        for number in range(1, 11)
    ]
    for kind, filename in (
        ("authorization", "authority-binding.json"),
        ("b1", "b1-binding.json"),
        ("tls", "tls-extension.json"),
        ("ssl", "ssl-context.json"),
        ("postgresql", "postgres-security.json"),
        ("secret_sweep", "secret-sweep.json"),
    ):
        payload = b'{"verified":true}\n'
        (root / filename).write_bytes(payload)
        artifacts.append(
            {
                "name": filename.removesuffix(".json"),
                "kind": kind,
                "case_id": None,
                "relative_path": filename,
                "sha256": hashlib.sha256(payload).hexdigest(),
                "size_bytes": len(payload),
            }
        )
    cases = [
        {
            "case_id": f"N{number}",
            "outcome": "passed",
            "reason_code": None,
            "duration_ms": number,
            "artifact_name": f"case-n{number}",
        }
        for number in range(1, 11)
    ]
    return {
        "schema_version": runtime_evidence.TERMINAL_SCHEMA_VERSION,
        "artifact_state": "raw",
        "attempt_id": "d2-runtime-r1",
        "outcome": "passed",
        "failure_reason_code": None,
        "repository_tuple": {
            name: {"commit_sha": HEX40, "tree_sha": "2" * 40}
            for name in ("suite", "soc", "ai", "fabric")
        },
        "authority": {
            "phase_a_auth_sha256": HEX64,
            "consumption_sha256": "b" * 64,
            "one_shot_consumed": True,
        },
        "b1": {
            "wheel_sha256": "c" * 64,
            "provenance_sha256": "d" * 64,
            "containment_test_sha256": "e" * 64,
            "loader_base_sha256": "f" * 64,
        },
        "counts": {
            "case_count": 10,
            "passed_count": 10,
            "failed_count": 0,
            "not_run_count": 0,
        },
        "cases": cases,
        "transport": {
            "tls_version": "TLSv1.3",
            "mtls_verified": True,
            "cnf_binding_verified": True,
            "asgi_tls_extension_verified": True,
            "ssl_hardened_options_preserved": True,
            "ssl_no_compression_verified": True,
        },
        "postgresql": {
            "role_rolsuper": False,
            "role_rolbypassrls": False,
            "role_rolcreaterole": False,
            "force_rls_table_count": 5,
            "cross_tenant_row_count": 0,
            "replay_row_count": 1,
        },
        "timings": {
            "started_at": "2026-08-02T08:00:00Z",
            "finished_at": "2026-08-02T08:00:01Z",
            "setup_ms": 400,
            "cases_ms": sum(range(1, 11)),
            "teardown_ms": 545,
            "total_ms": 1000,
        },
        "teardown": {
            "completed": True,
            "ai_process_absent": True,
            "soc_process_absent": True,
            "postgres_container_absent": True,
            "ai_listener_absent": True,
            "postgres_listener_absent": True,
            "runtime_root_absent": True,
            "pki_absent": True,
        },
        "pki_public": {
            "ephemeral": True,
            "destroyed": True,
            "certificate_count": 4,
            "public_artifact_count": 5,
            "public_artifacts": public_pki,
        },
        "artifacts": artifacts,
    }


@pytest.fixture
def evidence_root(tmp_path: Path) -> Path:
    root = tmp_path / "cybrik-uat-d2-evidence-unit"
    root.mkdir(mode=0o700)
    os.chmod(root, 0o700)
    return root


def _assert_reason(candidate: dict[str, object], reason: str) -> None:
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.validate_terminal_result(candidate)
    assert caught.value.reason == reason
    assert str(caught.value) == reason


def test_validate_accepts_and_detaches_exact_passed_result(evidence_root: Path) -> None:
    candidate = _passing_candidate(evidence_root)
    validated = runtime_evidence.validate_terminal_result(candidate)
    assert validated == candidate
    assert validated is not candidate
    assert validated["cases"] is not candidate["cases"]
    candidate["attempt_id"] = "mutated"
    assert validated["attempt_id"] == "d2-runtime-r1"


def test_canonical_result_can_be_read_and_validated_again(evidence_root: Path) -> None:
    candidate = _passing_candidate(evidence_root)
    canonical = runtime_evidence.canonical_json(candidate)
    reparsed = json.loads(canonical)
    assert runtime_evidence.validate_terminal_result(reparsed) == candidate


@pytest.mark.parametrize("missing", ("suite", "soc", "ai", "fabric"))
def test_exact_repository_tuple_is_mandatory(evidence_root: Path, missing: str) -> None:
    candidate = _passing_candidate(evidence_root)
    del candidate["repository_tuple"][missing]  # type: ignore[index]
    _assert_reason(candidate, "repository_tuple_invalid")


def test_auth_consumption_and_all_b1_digests_are_mandatory(evidence_root: Path) -> None:
    candidate = _passing_candidate(evidence_root)
    candidate["authority"]["one_shot_consumed"] = False  # type: ignore[index]
    _assert_reason(candidate, "authority_not_consumed")
    candidate = _passing_candidate(evidence_root)
    candidate["b1"]["loader_base_sha256"] = "not-a-digest"  # type: ignore[index]
    _assert_reason(candidate, "digest_invalid")


@pytest.mark.parametrize(
    ("mutation", "reason"),
    (
        (lambda value: value["cases"].pop(), "case_inventory_invalid"),
        (
            lambda value: value["cases"].__setitem__(
                1, copy.deepcopy(value["cases"][0])
            ),
            "case_inventory_invalid",
        ),
        (
            lambda value: value["counts"].__setitem__("passed_count", 9),
            "counts_do_not_reconcile",
        ),
        (
            lambda value: value["cases"][0].__setitem__("outcome", "failed"),
            "case_result_invalid",
        ),
    ),
)
def test_n1_n10_and_counts_are_exact(
    evidence_root: Path, mutation: object, reason: str
) -> None:
    candidate = _passing_candidate(evidence_root)
    mutation(candidate)  # type: ignore[operator]
    _assert_reason(candidate, reason)


@pytest.mark.parametrize(
    ("section", "field", "value", "reason"),
    (
        ("transport", "tls_version", "TLSv1.2", "passed_transport_invalid"),
        ("transport", "mtls_verified", False, "passed_transport_invalid"),
        ("transport", "cnf_binding_verified", False, "passed_transport_invalid"),
        ("postgresql", "role_rolsuper", True, "passed_postgresql_invalid"),
        ("postgresql", "role_rolbypassrls", True, "passed_postgresql_invalid"),
        ("postgresql", "role_rolcreaterole", True, "passed_postgresql_invalid"),
        ("postgresql", "force_rls_table_count", 4, "passed_postgresql_invalid"),
        ("postgresql", "cross_tenant_row_count", 1, "passed_postgresql_invalid"),
        ("postgresql", "replay_row_count", 2, "passed_postgresql_invalid"),
        ("teardown", "runtime_root_absent", False, "teardown_incomplete"),
        ("pki_public", "destroyed", False, "teardown_incomplete"),
    ),
)
def test_pass_requires_exact_security_and_teardown_invariants(
    evidence_root: Path,
    section: str,
    field: str,
    value: object,
    reason: str,
) -> None:
    candidate = _passing_candidate(evidence_root)
    candidate[section][field] = value  # type: ignore[index]
    _assert_reason(candidate, reason)


def test_failed_terminal_is_canonical_and_cannot_claim_pass(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    candidate["outcome"] = "failed"
    candidate["failure_reason_code"] = "n4_relying_party_refusal_missing"
    candidate["cases"][3].update(  # type: ignore[index]
        outcome="failed", reason_code="unexpected_accept"
    )
    candidate["cases"][4].update(  # type: ignore[index]
        outcome="not_run", reason_code="not_reached"
    )
    candidate["counts"] = {
        "case_count": 10,
        "passed_count": 8,
        "failed_count": 1,
        "not_run_count": 1,
    }
    assert runtime_evidence.validate_terminal_result(candidate)["outcome"] == "failed"

    false_failure = _passing_candidate(evidence_root)
    false_failure["outcome"] = "failed"
    false_failure["failure_reason_code"] = "claimed_failure"
    _assert_reason(false_failure, "failed_result_claims_pass")


def test_public_pki_metadata_cannot_carry_private_or_raw_material(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    candidate["pki_public"]["private_key_pem"] = "-----BEGIN PRIVATE KEY-----"  # type: ignore[index]
    _assert_reason(candidate, "pki_public_invalid")


def test_public_pki_inventory_binds_exact_real_files(evidence_root: Path) -> None:
    candidate = _passing_candidate(evidence_root)
    persisted = runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    result = json.loads(
        (evidence_root / runtime_evidence.RESULT_FILENAME).read_text(encoding="utf-8")
    )
    assert result["artifact_state"] == "sealed"
    assert runtime_evidence.validate_terminal_result(result) == result
    assert (
        persisted.result_sha256
        == hashlib.sha256(
            (evidence_root / runtime_evidence.RESULT_FILENAME).read_bytes()
        ).hexdigest()
    )
    public_records = result["pki_public"]["public_artifacts"]
    assert [record["name"] for record in public_records] == [
        name for name, _ in PKI_PUBLIC_PATHS
    ]
    for index, record in enumerate(public_records):
        assert record["relative_path"] == (
            f"sealed-pki-{index:02d}-{record['name']}.snapshot"
        )
        snapshot = evidence_root / record["relative_path"]
        assert snapshot.is_file() and not snapshot.is_symlink()
        assert stat.S_IMODE(snapshot.stat().st_mode) == 0o600
        assert hashlib.sha256(snapshot.read_bytes()).hexdigest() == record["sha256"]


@pytest.mark.parametrize(
    ("mutation", "reason"),
    (
        ("missing", "pki_public_artifact_unsafe"),
        ("substituted", "pki_public_inventory_invalid"),
        ("symlinked", "pki_public_artifact_unsafe"),
        ("tampered", "pki_public_artifact_digest_mismatch"),
    ),
)
def test_public_pki_missing_substituted_symlinked_and_tampered_files_fail(
    evidence_root: Path, mutation: str, reason: str
) -> None:
    candidate = _passing_candidate(evidence_root)
    if mutation == "missing":
        (evidence_root / "pki-public/server-cert.pem").unlink()
    elif mutation == "substituted":
        candidate["pki_public"]["public_artifacts"][1]["relative_path"] = (  # type: ignore[index]
            "pki-public/client-cert.pem"
        )
        _assert_reason(candidate, reason)
        return
    elif mutation == "symlinked":
        source = evidence_root / "pki-public/client-cert.pem"
        outside = evidence_root.parent / "outside-public-cert.pem"
        outside.write_bytes(source.read_bytes())
        source.unlink()
        source.symlink_to(outside)
    else:
        tampered = evidence_root / "pki-public/alternate-client-cert.pem"
        tampered.write_bytes(PUBLIC_TEST_CERTIFICATE.replace(b"MIIC", b"NIIC", 1))
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == reason


def test_public_pki_rejects_private_pem_and_private_jwk_even_when_rehashed(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    private_pem = b"-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n"
    certificate = evidence_root / "pki-public/ca-cert.pem"
    certificate.write_bytes(private_pem)
    candidate["pki_public"]["public_artifacts"][0].update(  # type: ignore[index]
        sha256=hashlib.sha256(private_pem).hexdigest(), size_bytes=len(private_pem)
    )
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "pki_public_material_invalid"

    candidate = _passing_candidate(evidence_root)
    private_jwk = b'{"keys":[{"alg":"ES256","crv":"P-256","d":"private","kid":"d2-public-key","kty":"EC","x":"x","y":"y"}]}\n'
    jwk = evidence_root / "pki-public/jwt-public-jwk.json"
    jwk.write_bytes(private_jwk)
    candidate["pki_public"]["public_artifacts"][4].update(  # type: ignore[index]
        sha256=hashlib.sha256(private_jwk).hexdigest(), size_bytes=len(private_jwk)
    )
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "pki_public_material_invalid"


def test_certificate_framing_does_not_admit_random_non_x509_bytes(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    framed_random = (
        b"-----BEGIN CERTIFICATE-----\n"
        b"bm90LWEtdmFsaWQteDUwOS1jZXJ0aWZpY2F0ZQ==\n"
        b"-----END CERTIFICATE-----\n"
    )
    certificate = evidence_root / "pki-public/ca-cert.pem"
    certificate.write_bytes(framed_random)
    candidate["pki_public"]["public_artifacts"][0].update(  # type: ignore[index]
        sha256=hashlib.sha256(framed_random).hexdigest(),
        size_bytes=len(framed_random),
    )
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "pki_public_material_invalid"
    assert not any(path.name.startswith("sealed-") for path in evidence_root.iterdir())


def test_public_certificate_contract_discloses_no_role_chain_or_distinctness_proof() -> (
    None
):
    limitation = (runtime_evidence.__doc__ or "").casefold()
    assert "parse-valid" in limitation
    assert "does not prove" in limitation
    assert all(word in limitation for word in ("role", "chain", "distinctness"))


def test_required_artifacts_are_unique_regular_contained_bounded_and_pinned(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    candidate["artifacts"][0]["sha256"] = HEX64  # type: ignore[index]
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "artifact_digest_mismatch"
    assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


def test_secret_bearing_artifact_is_rejected_before_terminal_write(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    payload = b"Authorization: Bearer synthetic-secret\n"
    path = evidence_root / "case-n1.json"
    path.write_bytes(payload)
    candidate["artifacts"][0].update(  # type: ignore[index]
        sha256=hashlib.sha256(payload).hexdigest(), size_bytes=len(payload)
    )
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "artifact_secret_bearing"
    assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


@pytest.mark.parametrize(
    "relative_path", ("../escape.json", "/tmp/escape.json", "a//b")
)
def test_artifact_traversal_is_rejected(
    evidence_root: Path, relative_path: str
) -> None:
    candidate = _passing_candidate(evidence_root)
    candidate["artifacts"][0]["relative_path"] = relative_path  # type: ignore[index]
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "artifact_path_invalid"


def test_symlinked_artifact_is_rejected(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    outside = evidence_root.parent / "outside.json"
    outside.write_text("{}", encoding="utf-8")
    linked = evidence_root / "linked.json"
    linked.symlink_to(outside)
    candidate["artifacts"][0].update(  # type: ignore[index]
        relative_path="linked.json",
        sha256=hashlib.sha256(b"{}").hexdigest(),
        size_bytes=2,
    )
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "artifact_unsafe"


def test_symlinked_intermediate_artifact_directory_is_rejected(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    outside_dir = evidence_root.parent / "outside-dir"
    outside_dir.mkdir()
    (outside_dir / "nested.json").write_text("{}", encoding="utf-8")
    (evidence_root / "alias").symlink_to(outside_dir, target_is_directory=True)
    candidate["artifacts"][0].update(  # type: ignore[index]
        relative_path="alias/nested.json",
        sha256=hashlib.sha256(b"{}").hexdigest(),
        size_bytes=2,
    )
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "artifact_unsafe"


def test_persist_writes_canonical_no_overwrite_mode_0600_packet(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    persisted = runtime_evidence.persist_terminal_evidence(evidence_root, candidate)

    paths = [
        evidence_root / runtime_evidence.RESULT_FILENAME,
        evidence_root / runtime_evidence.TEARDOWN_FILENAME,
        evidence_root / runtime_evidence.SUMMARY_FILENAME,
    ]
    assert all(path.is_file() and not path.is_symlink() for path in paths)
    assert all(stat.S_IMODE(path.stat().st_mode) == 0o600 for path in paths)
    assert stat.S_IMODE(evidence_root.stat().st_mode) == 0o700
    result = json.loads(paths[0].read_text(encoding="utf-8"))
    teardown = json.loads(paths[1].read_text(encoding="utf-8"))
    summary = json.loads(paths[2].read_text(encoding="utf-8"))
    assert result["repository_tuple"] == candidate["repository_tuple"]
    assert result["artifact_state"] == "sealed"
    assert all(
        artifact["relative_path"]
        == f"sealed-artifact-{index:02d}-{artifact['name']}.snapshot"
        for index, artifact in enumerate(result["artifacts"])
    )
    assert teardown["resources"] == candidate["teardown"]
    assert summary["terminal_passed"] is True
    assert summary["result_sha256"] == persisted.result_sha256
    assert summary["teardown_sha256"] == persisted.teardown_sha256
    assert paths[2].read_bytes().endswith(b"\n")

    before = {path.name: path.read_bytes() for path in paths}
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "terminal_path_exists"
    assert {path.name: path.read_bytes() for path in paths} == before


def test_raw_artifact_post_snapshot_swap_cannot_change_terminal_evidence(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)
    original = (evidence_root / "case-n1.json").read_bytes()
    real_seal = runtime_evidence._seal_artifact

    def seal_then_swap(root_fd: int, artifact: object, index: int) -> dict[str, object]:
        sealed = real_seal(root_fd, artifact, index)  # type: ignore[arg-type]
        if index == 0:
            source = evidence_root / "case-n1.json"
            source.unlink()
            source.write_bytes(b'{"passed":false,"tampered":true}\n')
        return sealed

    monkeypatch.setattr(runtime_evidence, "_seal_artifact", seal_then_swap)
    runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    result = json.loads(
        (evidence_root / runtime_evidence.RESULT_FILENAME).read_text(encoding="utf-8")
    )
    sealed_path = evidence_root / result["artifacts"][0]["relative_path"]
    assert sealed_path.read_bytes() == original
    assert (
        hashlib.sha256(sealed_path.read_bytes()).hexdigest()
        == result["artifacts"][0]["sha256"]
    )
    assert (evidence_root / "case-n1.json").read_bytes() != original


def test_mutation_during_snapshot_preserves_prior_snapshots_without_summary(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)
    target = evidence_root / "case-n2.json"
    target_inode = target.stat().st_ino
    real_read = runtime_evidence.os.read
    mutated = False

    def read_then_mutate(descriptor: int, count: int) -> bytes:
        nonlocal mutated
        block = real_read(descriptor, count)
        if block and not mutated and os.fstat(descriptor).st_ino == target_inode:
            mutated = True
            target.write_bytes(b'{"passed":xxxx}\n')
        return block

    monkeypatch.setattr(runtime_evidence.os, "read", read_then_mutate)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason in {"artifact_rebound", "artifact_digest_mismatch"}
    assert (evidence_root / "sealed-artifact-00-case-n1.snapshot").is_file()
    assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


def test_preexisting_snapshot_path_is_never_overwritten(evidence_root: Path) -> None:
    candidate = _passing_candidate(evidence_root)
    collision = evidence_root / "sealed-artifact-00-case-n1.snapshot"
    collision.write_text("preserve", encoding="utf-8")
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "terminal_path_exists"
    assert collision.read_text(encoding="utf-8") == "preserve"
    assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


def test_sealed_projection_path_overflow_fails_before_first_write(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    long_name = "a" * 120
    candidate["artifacts"][0]["name"] = long_name  # type: ignore[index]
    candidate["cases"][0]["artifact_name"] = long_name  # type: ignore[index]
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "artifact_path_invalid"
    assert not any(path.name.startswith("sealed-") for path in evidence_root.iterdir())
    assert not any(
        (evidence_root / name).exists()
        for name in (
            runtime_evidence.RESULT_FILENAME,
            runtime_evidence.TEARDOWN_FILENAME,
            runtime_evidence.SUMMARY_FILENAME,
        )
    )


def test_sealed_projection_size_overflow_fails_before_first_write(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)
    raw_size = len(runtime_evidence.canonical_json(candidate))
    monkeypatch.setattr(runtime_evidence, "MAX_TERMINAL_BYTES", raw_size + 1)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "terminal_record_too_large"
    assert not any(path.name.startswith("sealed-") for path in evidence_root.iterdir())
    assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


def test_evidence_root_must_be_absolute_descriptor_bound_mode_0700(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    os.chmod(evidence_root, 0o755)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "evidence_root_unsafe"

    target = evidence_root.parent / "cybrik-uat-d2-evidence-target"
    target.mkdir(mode=0o700)
    alias = evidence_root.parent / "cybrik-uat-d2-evidence-alias"
    alias.symlink_to(target, target_is_directory=True)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(alias, candidate)
    assert caught.value.reason == "evidence_root_unsafe"


def test_symlinked_evidence_ancestor_fails_closed_with_stable_reason(
    tmp_path: Path,
) -> None:
    actual_parent = tmp_path / "actual-parent"
    actual_parent.mkdir()
    actual_root = actual_parent / "cybrik-uat-d2-evidence-ancestor"
    actual_root.mkdir(mode=0o700)
    os.chmod(actual_root, 0o700)
    candidate = _passing_candidate(actual_root)
    alias_parent = tmp_path / "alias-parent"
    alias_parent.symlink_to(actual_parent, target_is_directory=True)
    aliased_root = alias_parent / actual_root.name
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(aliased_root, candidate)
    assert caught.value.reason == "evidence_root_unsafe"
    assert "symlinked ancestor" in (runtime_evidence.__doc__ or "").casefold()


def test_fail_is_annotated_as_non_returning() -> None:
    assert get_type_hints(runtime_evidence._fail)["return"] is NoReturn


def test_evidence_root_rebind_is_detected_before_terminal_write(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)
    preserved = evidence_root.with_name("cybrik-uat-d2-evidence-preserved")
    real_seal = runtime_evidence._seal_pki_public_artifact
    calls = 0

    def seal_then_rebind(
        root_fd: int, artifact: object, index: int
    ) -> dict[str, object]:
        nonlocal calls
        sealed = real_seal(root_fd, artifact, index)  # type: ignore[arg-type]
        calls += 1
        if calls == 1:
            evidence_root.rename(preserved)
            evidence_root.mkdir(mode=0o700)
            os.chmod(evidence_root, 0o700)
        return sealed

    monkeypatch.setattr(runtime_evidence, "_seal_pki_public_artifact", seal_then_rebind)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "evidence_root_rebound"
    assert preserved.is_dir()
    assert not (preserved / runtime_evidence.SUMMARY_FILENAME).exists()
    assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


def test_persist_fsyncs_each_file_and_directory(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)
    real_fsync = runtime_evidence.os.fsync
    synced_modes: list[int] = []

    def recording_fsync(descriptor: int) -> None:
        synced_modes.append(stat.S_IFMT(os.fstat(descriptor).st_mode))
        real_fsync(descriptor)

    monkeypatch.setattr(runtime_evidence.os, "fsync", recording_fsync)
    runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert synced_modes.count(stat.S_IFREG) >= 3
    assert synced_modes.count(stat.S_IFDIR) >= 3


def test_write_failure_preserves_existing_evidence_and_never_deletes_root(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)
    sentinel = evidence_root / "preexisting-evidence.json"
    sentinel.write_text("preserve", encoding="utf-8")
    real_link = runtime_evidence.os.link
    calls = 0

    def fail_second_link(*args: object, **kwargs: object) -> None:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("synthetic link failure")
        real_link(*args, **kwargs)

    monkeypatch.setattr(runtime_evidence.os, "link", fail_second_link)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "terminal_write_failed"
    assert evidence_root.is_dir()
    assert sentinel.read_text(encoding="utf-8") == "preserve"
    assert (evidence_root / "sealed-pki-00-ca_certificate.snapshot").is_file()
    assert not (evidence_root / runtime_evidence.RESULT_FILENAME).exists()
    assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


def test_atomic_writer_cleans_temp_descriptor_bound_after_write_failure(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root_fd = runtime_evidence._open_evidence_root(evidence_root)
    real_unlink = runtime_evidence.os.unlink
    real_fsync = runtime_evidence.os.fsync
    unlinks: list[tuple[str, int | None]] = []
    directory_fsyncs = 0

    def fail_write(descriptor: int, payload: bytes) -> int:
        raise OSError("synthetic write failure")

    def record_unlink(path: str, *, dir_fd: int | None = None) -> None:
        unlinks.append((path, dir_fd))
        real_unlink(path, dir_fd=dir_fd)

    def record_fsync(descriptor: int) -> None:
        nonlocal directory_fsyncs
        if stat.S_ISDIR(os.fstat(descriptor).st_mode):
            directory_fsyncs += 1
        real_fsync(descriptor)

    monkeypatch.setattr(runtime_evidence.os, "write", fail_write)
    monkeypatch.setattr(runtime_evidence.os, "unlink", record_unlink)
    monkeypatch.setattr(runtime_evidence.os, "fsync", record_fsync)
    try:
        with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
            runtime_evidence._atomic_no_overwrite(root_fd, "bounded.json", b"{}\n")
        assert caught.value.reason == "terminal_write_failed"
        assert unlinks and all(dir_fd == root_fd for _, dir_fd in unlinks)
        assert directory_fsyncs >= 1
        assert not (evidence_root / "bounded.json").exists()
        assert not any(path.name.endswith(".tmp") for path in evidence_root.iterdir())
    finally:
        os.close(root_fd)


def test_atomic_writer_cleans_temp_after_link_failure_without_destination(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root_fd = runtime_evidence._open_evidence_root(evidence_root)
    real_fsync = runtime_evidence.os.fsync
    directory_fsyncs = 0

    def fail_link(*args: object, **kwargs: object) -> None:
        raise OSError("synthetic link failure")

    def record_fsync(descriptor: int) -> None:
        nonlocal directory_fsyncs
        if stat.S_ISDIR(os.fstat(descriptor).st_mode):
            directory_fsyncs += 1
        real_fsync(descriptor)

    monkeypatch.setattr(runtime_evidence.os, "link", fail_link)
    monkeypatch.setattr(runtime_evidence.os, "fsync", record_fsync)
    try:
        with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
            runtime_evidence._atomic_no_overwrite(root_fd, "bounded.json", b"{}\n")
        assert caught.value.reason == "terminal_write_failed"
        assert directory_fsyncs >= 1
        assert not (evidence_root / "bounded.json").exists()
        assert not any(path.name.endswith(".tmp") for path in evidence_root.iterdir())
    finally:
        os.close(root_fd)


def test_atomic_writer_post_link_failure_keeps_committed_destination(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root_fd = runtime_evidence._open_evidence_root(evidence_root)
    real_fsync = runtime_evidence.os.fsync
    raised = False

    def fail_first_directory_fsync(descriptor: int) -> None:
        nonlocal raised
        if stat.S_ISDIR(os.fstat(descriptor).st_mode) and not raised:
            raised = True
            raise OSError("synthetic post-link fsync failure")
        real_fsync(descriptor)

    monkeypatch.setattr(runtime_evidence.os, "fsync", fail_first_directory_fsync)
    try:
        with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
            runtime_evidence._atomic_no_overwrite(
                root_fd, "bounded.json", b'{"preserve":true}\n'
            )
        assert caught.value.reason == "terminal_write_failed"
        assert (evidence_root / "bounded.json").read_bytes() == b'{"preserve":true}\n'
        assert not any(path.name.endswith(".tmp") for path in evidence_root.iterdir())
    finally:
        os.close(root_fd)


@pytest.mark.parametrize(
    "target_name",
    (
        runtime_evidence.RESULT_FILENAME,
        runtime_evidence.TEARDOWN_FILENAME,
        runtime_evidence.SUMMARY_FILENAME,
    ),
)
def test_terminal_payload_corruption_fails_descriptor_readback_without_acceptance(
    evidence_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    target_name: str,
) -> None:
    candidate = _passing_candidate(evidence_root)
    raw = runtime_evidence.validate_terminal_result(candidate)
    sealed = runtime_evidence._sealed_projection(raw)
    terminal_payloads = runtime_evidence._terminal_payloads(sealed)[:3]
    payload_by_name = dict(
        zip(
            (
                runtime_evidence.RESULT_FILENAME,
                runtime_evidence.TEARDOWN_FILENAME,
                runtime_evidence.SUMMARY_FILENAME,
            ),
            terminal_payloads,
            strict=True,
        )
    )
    target_payload = payload_by_name[target_name]
    real_write = runtime_evidence.os.write
    corrupted = False

    def corrupt_exact_terminal_write(descriptor: int, payload: bytes) -> int:
        nonlocal corrupted
        if not corrupted and payload == target_payload:
            corrupted = True
            return real_write(descriptor, b"[" + payload[1:])
        return real_write(descriptor, payload)

    monkeypatch.setattr(runtime_evidence.os, "write", corrupt_exact_terminal_write)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert corrupted is True
    assert caught.value.reason == "terminal_readback_failed"
    assert "/" not in str(caught.value)
    if target_name != runtime_evidence.SUMMARY_FILENAME:
        assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


def test_terminal_result_valid_json_schema_corruption_reaches_revalidation(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)
    raw = runtime_evidence.validate_terminal_result(candidate)
    sealed = runtime_evidence._sealed_projection(raw)
    result_payload = runtime_evidence._terminal_payloads(sealed)[0]
    real_write = runtime_evidence.os.write
    real_validate = runtime_evidence.validate_terminal_result
    validation_calls = 0

    def record_validation(value: object) -> dict[str, object]:
        nonlocal validation_calls
        validation_calls += 1
        return real_validate(value)

    def corrupt_schema_but_keep_json(descriptor: int, payload: bytes) -> int:
        if payload == result_payload:
            payload = payload.replace(
                b'"artifact_state":"sealed"',
                b'"artifact_state":"xealed"',
                1,
            )
        return real_write(descriptor, payload)

    monkeypatch.setattr(runtime_evidence, "validate_terminal_result", record_validation)
    monkeypatch.setattr(runtime_evidence.os, "write", corrupt_schema_but_keep_json)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "terminal_readback_failed"
    assert validation_calls == 3
    assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


@pytest.mark.parametrize(
    "target_name",
    (
        runtime_evidence.RESULT_FILENAME,
        runtime_evidence.TEARDOWN_FILENAME,
        runtime_evidence.SUMMARY_FILENAME,
    ),
)
def test_valid_canonical_terminal_mismatch_is_rejected(
    evidence_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    target_name: str,
) -> None:
    candidate = _passing_candidate(evidence_root)
    raw = runtime_evidence.validate_terminal_result(candidate)
    sealed = runtime_evidence._sealed_projection(raw)
    payload_by_name = dict(
        zip(
            (
                runtime_evidence.RESULT_FILENAME,
                runtime_evidence.TEARDOWN_FILENAME,
                runtime_evidence.SUMMARY_FILENAME,
            ),
            runtime_evidence._terminal_payloads(sealed),
            strict=True,
        )
    )
    target_payload = payload_by_name[target_name]
    real_write = runtime_evidence.os.write
    changed = False

    def change_valid_identifier(descriptor: int, payload: bytes) -> int:
        nonlocal changed
        if payload == target_payload:
            payload = payload.replace(b"d2-runtime-r1", b"d2-runtime-r2", 1)
            changed = True
        return real_write(descriptor, payload)

    monkeypatch.setattr(runtime_evidence.os, "write", change_valid_identifier)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert changed is True
    assert caught.value.reason == "terminal_readback_failed"
    assert "/" not in str(caught.value)
    if target_name != runtime_evidence.SUMMARY_FILENAME:
        assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


def test_terminal_readback_rejects_byte_identical_inode_replacement(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)
    real_atomic = runtime_evidence._atomic_no_overwrite
    replaced = False

    def replace_result_after_commit(root_fd: int, name: str, payload: bytes) -> object:
        nonlocal replaced
        committed = real_atomic(root_fd, name, payload)
        if name == runtime_evidence.RESULT_FILENAME:
            path = evidence_root / name
            prior_inode = path.stat().st_ino
            preserved = evidence_root / ".preserved-result-inode"
            os.link(path, preserved)
            path.unlink()
            path.write_bytes(payload)
            os.chmod(path, 0o600)
            assert path.stat().st_ino != prior_inode
            preserved.unlink()
            replaced = True
        return committed

    monkeypatch.setattr(
        runtime_evidence, "_atomic_no_overwrite", replace_result_after_commit
    )
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert replaced is True
    assert caught.value.reason == "terminal_readback_failed"
    assert not (evidence_root / runtime_evidence.SUMMARY_FILENAME).exists()


def test_atomic_writer_cleans_temp_when_initial_fstat_fails(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root_fd = runtime_evidence._open_evidence_root(evidence_root)
    real_fstat = runtime_evidence.os.fstat
    first = True

    def fail_initial_fstat(descriptor: int) -> os.stat_result:
        nonlocal first
        if first:
            first = False
            raise OSError("synthetic initial fstat failure")
        return real_fstat(descriptor)

    monkeypatch.setattr(runtime_evidence.os, "fstat", fail_initial_fstat)
    try:
        with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
            runtime_evidence._atomic_no_overwrite(root_fd, "bounded.json", b"{}\n")
        assert caught.value.reason == "terminal_write_failed"
        assert not (evidence_root / "bounded.json").exists()
        assert not any(path.name.endswith(".tmp") for path in evidence_root.iterdir())
    finally:
        os.close(root_fd)


def test_atomic_writer_rejects_lied_short_write_by_final_size(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root_fd = runtime_evidence._open_evidence_root(evidence_root)
    real_write = runtime_evidence.os.write
    lied = False

    def truncate_but_report_complete(descriptor: int, payload: bytes) -> int:
        nonlocal lied
        lied = True
        real_write(descriptor, payload[:-1])
        return len(payload)

    monkeypatch.setattr(runtime_evidence.os, "write", truncate_but_report_complete)
    try:
        with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
            runtime_evidence._atomic_no_overwrite(root_fd, "bounded.json", b"{}\n")
        assert lied is True
        assert caught.value.reason == "terminal_write_failed"
        assert not any(path.name.endswith(".tmp") for path in evidence_root.iterdir())
    finally:
        os.close(root_fd)


def test_artifact_root_dup_failure_is_stable_and_path_free(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)

    def fail_dup(descriptor: int) -> int:
        raise OSError(f"synthetic dup failure for descriptor {descriptor}")

    monkeypatch.setattr(runtime_evidence.os, "dup", fail_dup)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "pki_public_artifact_unsafe"
    assert "/" not in str(caught.value)


def test_committed_readback_close_failure_is_stable(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root_fd = runtime_evidence._open_evidence_root(evidence_root)
    payload = b"{}\n"
    runtime_evidence._atomic_no_overwrite(root_fd, "bounded.json", payload)
    real_close = runtime_evidence.os.close
    failed = False

    def fail_regular_file_close(descriptor: int) -> None:
        nonlocal failed
        if not failed and stat.S_ISREG(os.fstat(descriptor).st_mode):
            failed = True
            real_close(descriptor)
            raise OSError("synthetic close failure")
        real_close(descriptor)

    monkeypatch.setattr(runtime_evidence.os, "close", fail_regular_file_close)
    try:
        with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
            runtime_evidence._read_committed_payload(
                root_fd,
                "bounded.json",
                len(payload),
                "terminal_readback_failed",
            )
        assert failed is True
        assert caught.value.reason == "terminal_readback_failed"
    finally:
        monkeypatch.setattr(runtime_evidence.os, "close", real_close)
        real_close(root_fd)


def test_terminal_json_recursion_failure_is_stable(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root_fd = runtime_evidence._open_evidence_root(evidence_root)
    payload = b"{}\n"
    committed = runtime_evidence._atomic_no_overwrite(
        root_fd, runtime_evidence.SUMMARY_FILENAME, payload
    )

    def fail_json_decode(value: object) -> object:
        raise RecursionError("synthetic nested JSON failure")

    monkeypatch.setattr(runtime_evidence.json, "loads", fail_json_decode)
    try:
        with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
            runtime_evidence._validate_terminal_readback(
                root_fd,
                runtime_evidence.SUMMARY_FILENAME,
                payload,
                committed.identity,
            )
        assert caught.value.reason == "terminal_readback_failed"
    finally:
        os.close(root_fd)


@pytest.mark.parametrize(
    ("target_kind", "reason"),
    (
        ("regular", "pki_public_artifact_unsafe"),
        ("directory", "artifact_unsafe"),
    ),
)
def test_bound_artifact_close_failure_is_stable(
    evidence_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    target_kind: str,
    reason: str,
) -> None:
    candidate = _passing_candidate(evidence_root)
    if target_kind == "regular":
        artifact = candidate["pki_public"]["public_artifacts"][0]  # type: ignore[index]
        namespace = "pki"
    else:
        artifact = candidate["artifacts"][0]  # type: ignore[index]
        namespace = "artifact"
    root_fd = runtime_evidence._open_evidence_root(evidence_root)
    real_close = runtime_evidence.os.close
    failed = False

    def fail_regular_file_close(descriptor: int) -> None:
        nonlocal failed
        details = os.fstat(descriptor)
        matches = (
            stat.S_ISREG(details.st_mode)
            if target_kind == "regular"
            else stat.S_ISDIR(details.st_mode) and descriptor != root_fd
        )
        if not failed and matches:
            failed = True
            real_close(descriptor)
            raise OSError("synthetic artifact close failure")
        real_close(descriptor)

    monkeypatch.setattr(runtime_evidence.os, "close", fail_regular_file_close)
    try:
        with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
            runtime_evidence._read_bound_artifact(
                root_fd,
                artifact,  # type: ignore[arg-type]
                namespace=namespace,
            )
        assert failed is True
        assert caught.value.reason == reason
        assert "/" not in str(caught.value)
    finally:
        monkeypatch.setattr(runtime_evidence.os, "close", real_close)
        real_close(root_fd)


def test_evidence_root_close_failure_is_stable_after_terminal_write(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    candidate = _passing_candidate(evidence_root)
    real_open_root = runtime_evidence._open_evidence_root
    real_close = runtime_evidence.os.close
    root_fd = -1

    def record_root(path: Path) -> int:
        nonlocal root_fd
        root_fd = real_open_root(path)
        return root_fd

    def fail_root_close(descriptor: int) -> None:
        if descriptor == root_fd:
            real_close(descriptor)
            raise OSError("synthetic evidence root close failure")
        real_close(descriptor)

    monkeypatch.setattr(runtime_evidence, "_open_evidence_root", record_root)
    monkeypatch.setattr(runtime_evidence.os, "close", fail_root_close)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence.persist_terminal_evidence(evidence_root, candidate)
    assert caught.value.reason == "evidence_root_close_failed"
    assert "/" not in str(caught.value)


def test_absolute_directory_transition_close_failure_is_stable(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    real_close = runtime_evidence.os.close
    failed = False

    def fail_first_close(descriptor: int) -> None:
        nonlocal failed
        real_close(descriptor)
        if not failed:
            failed = True
            raise OSError("synthetic directory transition close failure")

    monkeypatch.setattr(runtime_evidence.os, "close", fail_first_close)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence._open_absolute_directory(evidence_root, "evidence_root_unsafe")
    assert failed is True
    assert caught.value.reason == "evidence_root_unsafe"
    assert "/" not in str(caught.value)


def test_directory_binding_rebound_close_failure_is_stable(
    evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    descriptor = runtime_evidence._open_evidence_root(evidence_root)
    real_open_absolute = runtime_evidence._open_absolute_directory
    real_close = runtime_evidence.os.close
    rebound_fd = -1

    def record_rebound(path: Path, reason: str) -> int:
        nonlocal rebound_fd
        rebound_fd = real_open_absolute(path, reason)
        return rebound_fd

    def fail_rebound_close(candidate_fd: int) -> None:
        real_close(candidate_fd)
        if candidate_fd == rebound_fd:
            raise OSError("synthetic rebound close failure")

    monkeypatch.setattr(runtime_evidence, "_open_absolute_directory", record_rebound)
    monkeypatch.setattr(runtime_evidence.os, "close", fail_rebound_close)
    try:
        with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
            runtime_evidence._assert_directory_binding(
                evidence_root, descriptor, "evidence_root_rebound"
            )
        assert caught.value.reason == "evidence_root_rebound"
    finally:
        monkeypatch.setattr(runtime_evidence.os, "close", real_close)
        real_close(descriptor)


@pytest.mark.parametrize("failure", ("fstat", "close"))
def test_open_evidence_root_descriptor_failures_are_stable(
    evidence_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    real_open_absolute = runtime_evidence._open_absolute_directory
    real_fstat = runtime_evidence.os.fstat
    real_close = runtime_evidence.os.close
    final_fd = -1
    armed = False

    def record_final(path: Path, reason: str) -> int:
        nonlocal final_fd, armed
        final_fd = real_open_absolute(path, reason)
        armed = True
        return final_fd

    def fail_final_fstat(descriptor: int) -> os.stat_result:
        if armed and descriptor == final_fd:
            raise OSError("synthetic root fstat failure")
        return real_fstat(descriptor)

    def fail_final_close(descriptor: int) -> None:
        real_close(descriptor)
        if descriptor == final_fd:
            raise OSError("synthetic unsafe root close failure")

    monkeypatch.setattr(runtime_evidence, "_open_absolute_directory", record_final)
    if failure == "fstat":
        monkeypatch.setattr(runtime_evidence.os, "fstat", fail_final_fstat)
    else:
        os.chmod(evidence_root, 0o755)
        monkeypatch.setattr(runtime_evidence.os, "close", fail_final_close)
    with pytest.raises(runtime_evidence.RuntimeEvidenceError) as caught:
        runtime_evidence._open_evidence_root(evidence_root)
    assert caught.value.reason == "evidence_root_unsafe"
    assert "/" not in str(caught.value)


def test_partial_seal_poisoning_is_documented_as_non_retryable_preservation() -> None:
    contract = (runtime_evidence.__doc__ or "").casefold()
    assert "partially sealed" in contract
    assert "non-retryable" in contract
    assert "do not delete" in contract


def test_canonical_bytes_are_order_independent_and_secret_free(
    evidence_root: Path,
) -> None:
    candidate = _passing_candidate(evidence_root)
    reversed_candidate = dict(reversed(tuple(candidate.items())))
    assert runtime_evidence.canonical_json(
        candidate
    ) == runtime_evidence.canonical_json(reversed_candidate)
    secret = copy.deepcopy(candidate)
    secret["attempt_id"] = "Bearer secret-value"
    _assert_reason(secret, "identifier_invalid")
