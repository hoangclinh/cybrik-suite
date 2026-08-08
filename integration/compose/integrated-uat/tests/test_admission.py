from __future__ import annotations

import hashlib
import json
import os
from dataclasses import FrozenInstanceError
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest

from cybrik_suite_integrated_uat.admission import (
    HELPER_SCRIPTS,
    MASTER_AUTHORIZATION_SCHEMA,
    MASTER_TRACKED_ALLOWLIST,
    AdmissionDependencies,
    IntegratedAdmissionError,
    admit_master_authorization,
    load_master_environment,
)
from cybrik_suite_integrated_uat.models import (
    EXPECTED_EXTERNAL_CAPABILITIES,
    EXPECTED_REPOSITORIES,
    ExternalRootBinding,
    RepositoryRoot,
    external_roots_digest,
    repository_roots_digest,
    repository_tuple_digest,
)


def _private(directory: Path) -> Path:
    directory.mkdir()
    directory.chmod(0o700)
    return directory.resolve()


def _environment(tmp_path: Path) -> tuple[dict[str, str], object]:
    repositories = tuple(
        _private(tmp_path / name) for name in ("suite", "soc", "ai", "fabric")
    )
    master = _private(tmp_path / "master-evidence")
    external = tuple(
        _private(tmp_path / name)
        for name in (
            "cybrik-uat-d2-runtime-master-run-1",
            "cybrik-uat-d2-evidence-master-run-1",
            "alert-runtime",
            "alert-evidence",
            "alert-state",
        )
    )
    python = tmp_path / "python"
    python.write_bytes(b"python")
    python.chmod(0o700)
    authorization = tmp_path / "authorization.json"
    signature = tmp_path / "authorization.sig"
    b1_wheel = tmp_path / "b1.whl"
    authorization.write_bytes(b"{}")
    signature.write_bytes(b"signed-exact-head")
    b1_wheel.write_bytes(b"wheel")
    authorization.chmod(0o600)
    signature.chmod(0o600)
    b1_wheel.chmod(0o600)
    authority = SimpleNamespace(
        repositories=SimpleNamespace(
            roots=repositories,
            suite=repositories[0],
            soc=repositories[1],
            cyber_ai=repositories[2],
            tool_fabric=repositories[3],
        ),
        external=SimpleNamespace(
            runtime_root=external[2],
            evidence_root=external[3],
            state_root=external[4],
        ),
        authorization_file=authorization,
        signature_file=signature,
        allowed_signers_file=authorization,
        allowed_signer="FOUNDER",
        b1_wheel=b1_wheel.resolve(),
        python=python.resolve(),
        master_evidence=master,
        d2_roots=external[:2],
    )
    environment = {
        "CYBRIK_UAT_SUITE_ROOT": str(repositories[0]),
        "CYBRIK_UAT_SOC_ROOT": str(repositories[1]),
        "CYBRIK_UAT_CYBER_AI_ROOT": str(repositories[2]),
        "CYBRIK_UAT_TOOL_FABRIC_ROOT": str(repositories[3]),
        "CYBRIK_UAT_RUNTIME_ROOT": str(external[2]),
        "CYBRIK_UAT_EVIDENCE_ROOT": str(external[3]),
        "CYBRIK_UAT_STATE_ROOT": str(external[4]),
        "CYBRIK_UAT_AUTHORIZATION_FILE": str(authorization),
        "CYBRIK_UAT_AUTHORIZATION_SIGNATURE": str(signature),
        "CYBRIK_UAT_AUTHORIZATION_ALLOWED_SIGNERS": str(authorization),
        "CYBRIK_UAT_ALLOWED_SIGNER": "FOUNDER",
        "CYBRIK_UAT_B1_WHEEL": str(b1_wheel.resolve()),
        "CYBRIK_UAT_PYTHON": str(python.resolve()),
        "CYBRIK_UAT_MASTER_EVIDENCE_ROOT": str(master),
        "CYBRIK_UAT_D2_RUNTIME_DIR": str(external[0]),
        "CYBRIK_UAT_D2_EVIDENCE_DIR": str(external[1]),
    }
    return environment, authority


def _dependencies(
    authority: object,
    *,
    mutate: object | None = None,
    payload_transform: object | None = None,
) -> tuple[AdmissionDependencies, dict[str, int]]:
    calls = {"load": 0, "verify": 0, "observe": 0, "aggregate": 0}
    commits = ("1" * 40, "2" * 40, "3" * 40, "4" * 40)
    trees = ("a" * 40, "b" * 40, "c" * 40, "d" * 40)
    observations = tuple(
        SimpleNamespace(role=role, root=root, commit=commit, tree=tree)
        for role, root, commit, tree in zip(
            ("suite", "soc", "cyber_ai", "tool_fabric"),
            authority.repositories.roots,
            commits,
            trees,
            strict=True,
        )
    )
    aggregate = SimpleNamespace(
        algorithm="cybrik-uat-tracked-blob-sha256-lines/v1",
        file_count=sum(len(paths) for paths in MASTER_TRACKED_ALLOWLIST.values()),
        sha256="e" * 64,
    )
    helper_digests = {
        path: hashlib.sha256(path.as_posix().encode()).hexdigest()
        for path in HELPER_SCRIPTS
    }
    repository_roots = tuple(
        RepositoryRoot(repository, root)
        for repository, root in zip(
            EXPECTED_REPOSITORIES,
            (
                authority.repositories.soc,
                authority.repositories.cyber_ai,
                authority.repositories.tool_fabric,
                authority.repositories.suite,
            ),
            strict=True,
        )
    )
    external_roots = tuple(
        ExternalRootBinding(capability, root)
        for capability, root in zip(
            EXPECTED_EXTERNAL_CAPABILITIES,
            (
                *authority.d2_roots,
                *(
                    authority.external.runtime_root,
                    authority.external.evidence_root,
                    authority.external.state_root,
                ),
            ),
            strict=True,
        )
    )
    record = {
        "authorization_id": "master-run-1",
        "authorized_by": "FOUNDER",
        "b1_wheel": {
            "path": str(authority.b1_wheel),
            "sha256": hashlib.sha256(b"wheel").hexdigest(),
        },
        "decision": "APPROVE",
        "evidence_root": str(authority.master_evidence),
        "expires_at": "2026-08-03T01:00:00+00:00",
        "external_roots": [item.to_dict() for item in external_roots],
        "external_roots_sha256": external_roots_digest(external_roots),
        "helper_scripts": [
            {"path": path.as_posix(), "sha256": helper_digests[path]}
            for path in HELPER_SCRIPTS
        ],
        "issued_at": "2026-08-03T00:00:00+00:00",
        "one_shot": True,
        "python": {
            "path": str(authority.python),
            "sha256": hashlib.sha256(b"python").hexdigest(),
        },
        "repository_roots": [item.to_dict() for item in repository_roots],
        "repository_roots_sha256": repository_roots_digest(repository_roots),
        "schema": MASTER_AUTHORIZATION_SCHEMA,
        "tracked_blob_aggregate": {
            "algorithm": aggregate.algorithm,
            "file_count": aggregate.file_count,
            "sha256": aggregate.sha256,
        },
        "tuple": {
            item.role: {"commit": item.commit, "tree": item.tree}
            for item in observations
        },
    }
    if callable(mutate):
        mutate(record)
    payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode()
    if callable(payload_transform):
        payload = payload_transform(payload)
    intent = SimpleNamespace(
        expectations=tuple(object() for _ in range(4)),
        payload=payload,
        signature=b"signed-exact-head",
    )

    def load(_environment: object) -> object:
        calls["load"] += 1
        return authority

    def verify(config: object) -> object:
        assert config is authority
        calls["verify"] += 1
        return intent

    def observe(expectations: object) -> object:
        assert expectations is intent.expectations
        calls["observe"] += 1
        return observations

    def calculate(items: object, allowlist: object) -> object:
        assert items == observations
        assert allowlist is MASTER_TRACKED_ALLOWLIST
        calls["aggregate"] += 1
        return aggregate

    dependencies = AdmissionDependencies(
        helper_sha256=lambda _suite, relative: helper_digests[relative],
        load_runtime_environment=load,
        now=lambda: datetime(2026, 8, 3, tzinfo=UTC),
        observe_exact_tuple=observe,
        tracked_blob_aggregate=calculate,
        verify_signed_intent=verify,
    )
    return dependencies, calls


def test_admission_reuses_one_signed_intent_and_maps_exact_master_tuple(
    tmp_path: Path,
) -> None:
    environment, authority = _environment(tmp_path)
    dependencies, calls = _dependencies(authority)

    admitted = admit_master_authorization(environment, dependencies=dependencies)

    assert calls == {"load": 1, "verify": 1, "observe": 1, "aggregate": 1}
    authorization = admitted.authorization
    assert (
        tuple(item.repository for item in authorization.repository_tuple)
        == EXPECTED_REPOSITORIES
    )
    assert tuple(item.commit for item in authorization.repository_tuple) == (
        "2" * 40,
        "3" * 40,
        "4" * 40,
        "1" * 40,
    )
    assert all(item.clean is True for item in authorization.repository_tuple)
    assert (
        repository_tuple_digest(authorization.repository_tuple)
        == authorization.repository_tuple_sha256
    )
    assert (
        repository_roots_digest(authorization.repository_roots)
        == authorization.repository_roots_sha256
    )
    assert (
        tuple(item.capability for item in authorization.external_roots)
        == EXPECTED_EXTERNAL_CAPABILITIES
    )
    assert (
        external_roots_digest(authorization.external_roots)
        == authorization.external_roots_sha256
    )
    assert (
        authorization.exact_head_grant_sha256
        == hashlib.sha256(b"signed-exact-head").hexdigest()
    )
    assert admitted.python_executable == authority.python
    assert admitted.python_sha256 == hashlib.sha256(b"python").hexdigest()
    assert admitted.b1_wheel == authority.b1_wheel
    assert admitted.b1_wheel_sha256 == hashlib.sha256(b"wheel").hexdigest()
    assert admitted.authorization_file == authority.authorization_file
    assert admitted.authorization_signature == authority.signature_file
    assert admitted.allowed_signers_file == authority.allowed_signers_file
    assert tuple(admitted.helper_sha256) == HELPER_SCRIPTS


@pytest.mark.parametrize(
    "mutate",
    (
        lambda record: record.__setitem__("schema", "CYBRIK-UAT-SOC-AI-FABRIC-AUTH/v1"),
        lambda record: record.__setitem__("evidence_root", "/substituted/evidence"),
        lambda record: record.__setitem__("external_roots_sha256", "0" * 64),
        lambda record: record.__setitem__("repository_roots_sha256", "0" * 64),
        lambda record: record["external_roots"][0].__setitem__(
            "root", "/substituted/runtime"
        ),
        lambda record: record["repository_roots"][0].__setitem__(
            "root", "/substituted/repository"
        ),
        lambda record: record["helper_scripts"][0].__setitem__("sha256", "0" * 64),
        lambda record: record["helper_scripts"][0].__setitem__(
            "path", "substituted.py"
        ),
        lambda record: record["b1_wheel"].__setitem__("sha256", "0" * 64),
        lambda record: record["b1_wheel"].__setitem__("path", "/substituted/b1.whl"),
        lambda record: record["python"].__setitem__("sha256", "0" * 64),
        lambda record: record["python"].__setitem__("path", "/substituted/python"),
        lambda record: record["tracked_blob_aggregate"].__setitem__("sha256", "0" * 64),
        lambda record: record["tuple"]["soc"].__setitem__("commit", "0" * 40),
        lambda record: record.__setitem__("authorized_by", "CODEX_GOVERNOR"),
        lambda record: record.__setitem__("expires_at", "2026-08-03T00:00:00+00:00"),
    ),
)
def test_signed_master_binding_rejects_every_substitution(
    tmp_path: Path, mutate: object
) -> None:
    environment, authority = _environment(tmp_path)
    dependencies, calls = _dependencies(authority, mutate=mutate)

    with pytest.raises(IntegratedAdmissionError, match="master_authorization"):
        admit_master_authorization(environment, dependencies=dependencies)

    assert calls["verify"] == 1


def test_signed_master_binding_rejects_noncanonical_payload(tmp_path: Path) -> None:
    environment, authority = _environment(tmp_path)
    dependencies, calls = _dependencies(
        authority, payload_transform=lambda payload: payload + b"\n"
    )

    with pytest.raises(
        IntegratedAdmissionError, match="master_authorization_not_canonical"
    ):
        admit_master_authorization(environment, dependencies=dependencies)

    assert calls["verify"] == 1


def test_master_environment_requires_disjoint_empty_private_roots(
    tmp_path: Path,
) -> None:
    environment, authority = _environment(tmp_path)
    dependencies, _calls = _dependencies(authority)
    Path(environment["CYBRIK_UAT_D2_RUNTIME_DIR"]).chmod(0o755)

    with pytest.raises(IntegratedAdmissionError, match="master_external_root_invalid"):
        load_master_environment(environment, dependencies=dependencies)

    Path(environment["CYBRIK_UAT_D2_RUNTIME_DIR"]).chmod(0o700)
    Path(environment["CYBRIK_UAT_D2_RUNTIME_DIR"], "unexpected").write_text("x")
    with pytest.raises(
        IntegratedAdmissionError, match="master_external_root_not_empty"
    ):
        load_master_environment(environment, dependencies=dependencies)


@pytest.mark.parametrize(
    ("index", "environment_name"),
    (
        (0, "CYBRIK_UAT_D2_RUNTIME_DIR"),
        (1, "CYBRIK_UAT_D2_EVIDENCE_DIR"),
    ),
)
def test_signed_master_admission_rejects_wrong_d2_root_leaf_before_consumption(
    tmp_path: Path, index: int, environment_name: str
) -> None:
    environment, authority = _environment(tmp_path)
    wrong = authority.d2_roots[index].rename(tmp_path / f"wrong-d2-root-{index}")
    d2_roots = list(authority.d2_roots)
    d2_roots[index] = wrong
    authority.d2_roots = tuple(d2_roots)
    environment[environment_name] = str(wrong)
    dependencies, calls = _dependencies(authority)

    with pytest.raises(
        IntegratedAdmissionError, match="master_postgres_root_not_purpose_bound"
    ):
        admit_master_authorization(environment, dependencies=dependencies)

    assert calls["verify"] == 1


def test_master_environment_rejects_root_overlap_and_unknown_uat_input(
    tmp_path: Path,
) -> None:
    environment, authority = _environment(tmp_path)
    dependencies, _calls = _dependencies(authority)
    overlapping = dict(environment)
    overlapping["CYBRIK_UAT_D2_EVIDENCE_DIR"] = overlapping["CYBRIK_UAT_D2_RUNTIME_DIR"]

    with pytest.raises(
        IntegratedAdmissionError, match="master_external_roots_not_disjoint"
    ):
        load_master_environment(overlapping, dependencies=dependencies)

    unknown = {**environment, "CYBRIK_UAT_UNDECLARED": "x"}
    with pytest.raises(IntegratedAdmissionError, match="master_environment_unknown"):
        load_master_environment(unknown, dependencies=dependencies)


def test_master_environment_rejects_authority_root_redirection(tmp_path: Path) -> None:
    environment, authority = _environment(tmp_path)
    redirected = _private(tmp_path / "redirected-alert-runtime")
    authority.external = SimpleNamespace(
        runtime_root=redirected,
        evidence_root=authority.external.evidence_root,
        state_root=authority.external.state_root,
    )
    dependencies, _calls = _dependencies(authority)

    with pytest.raises(IntegratedAdmissionError, match="master_environment_invalid"):
        load_master_environment(environment, dependencies=dependencies)


def test_allowlist_is_exactly_sorted_unique_and_covers_runtime_surfaces() -> None:
    assert tuple(MASTER_TRACKED_ALLOWLIST) == (
        "suite",
        "soc",
        "cyber_ai",
        "tool_fabric",
    )
    for paths in MASTER_TRACKED_ALLOWLIST.values():
        assert paths == tuple(sorted(set(paths)))
        assert paths

    suite = set(MASTER_TRACKED_ALLOWLIST["suite"])
    assert {path.as_posix() for path in HELPER_SCRIPTS} <= suite
    assert "integration/compose/integrated-uat/scripts/run_integrated_uat.py" in suite
    assert (
        "integration/compose/integrated-uat/src/cybrik_suite_integrated_uat/admission.py"
        in suite
    )
    assert (
        "integration/compose/integrated-uat/src/cybrik_suite_integrated_uat/bootstrap.py"
        in suite
    )
    assert (
        "integration/compose/soc-ai-lifecycle-create-mtls/src/cybrik_suite_uat_mtls/postgres_stage.py"
        in suite
    )
    assert (
        "integration/compose/soc-ai-fabric-alert-context-mtls/src/cybrik_suite_uat_fabric/integrated_stage.py"
        in suite
    )


def test_admission_objects_are_frozen(tmp_path: Path) -> None:
    environment, authority = _environment(tmp_path)
    dependencies, _calls = _dependencies(authority)
    admitted = admit_master_authorization(environment, dependencies=dependencies)

    with pytest.raises(FrozenInstanceError):
        admitted.python_executable = Path("/different")  # type: ignore[misc]
    assert os.stat(admitted.authorization.evidence_root).st_mode & 0o777 == 0o700
