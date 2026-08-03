from __future__ import annotations

import ast
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

from cybrik_suite_integrated_uat.models import (
    EXPECTED_REPOSITORIES,
    RepositoryRoot,
    repository_roots_digest,
)

ROOT = Path(__file__).parents[1]
SCRIPTS = ROOT / "scripts"
COMMON_PATH = SCRIPTS / "common_teardown.py"
EXTERNAL_CAPABILITIES = (
    "postgres_d2_runtime",
    "postgres_d2_evidence",
    "alert_context_runtime",
    "alert_context_evidence",
    "alert_context_state",
)
ENV = {
    "HOME": str(Path.home()),
    "LANG": "C",
    "LC_ALL": "C",
    "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
}


def _load(path: Path, name: str) -> object:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n"


def _external_roots_digest(roots: tuple[tuple[str, Path], ...]) -> str:
    payload = (
        json.dumps(
            [
                {"capability": capability, "root": str(root)}
                for capability, root in roots
            ],
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        + b"\n"
    )
    return hashlib.sha256(payload).hexdigest()


def _create_repo(root: Path) -> None:
    root.mkdir(parents=True)
    subprocess.run(["git", "init", "-q"], cwd=root, env=ENV, check=True)
    subprocess.run(
        ["git", "config", "user.name", "CYBRIK"], cwd=root, env=ENV, check=True
    )
    subprocess.run(
        ["git", "config", "user.email", "cybrik@example.invalid"],
        cwd=root,
        env=ENV,
        check=True,
    )
    (root / "tracked.txt").write_text(root.name, encoding="utf-8")
    subprocess.run(["git", "add", "tracked.txt"], cwd=root, env=ENV, check=True)
    subprocess.run(["git", "commit", "-qm", "seed"], cwd=root, env=ENV, check=True)


def _repository_roots(tmp_path: Path) -> tuple[RepositoryRoot, ...]:
    roots = tuple(tmp_path / "repositories" / name for name in EXPECTED_REPOSITORIES)
    for root in roots:
        _create_repo(root)
    return tuple(
        RepositoryRoot(repository=name, root=root)
        for name, root in zip(EXPECTED_REPOSITORIES, roots)
    )


def _external_roots(tmp_path: Path) -> tuple[tuple[str, Path], ...]:
    roots = tuple(
        (capability, tmp_path / "external" / capability)
        for capability in EXTERNAL_CAPABILITIES
    )
    for _, root in roots:
        root.mkdir(parents=True)
    return roots


def _materialize_owned_resources(external_roots: tuple[tuple[str, Path], ...]) -> None:
    by_capability = dict(external_roots)
    by_capability["postgres_d2_runtime"].joinpath("01-process.marker").write_text(
        "process", encoding="utf-8"
    )
    by_capability["postgres_d2_evidence"].joinpath("02-container.marker").write_text(
        "container", encoding="utf-8"
    )
    by_capability["postgres_d2_runtime"].joinpath("03-postgres").mkdir()
    by_capability["alert_context_evidence"].joinpath("04-private.json").write_text(
        "private", encoding="utf-8"
    )
    by_capability["alert_context_runtime"].joinpath("05-runtime").mkdir()
    by_capability["alert_context_state"].joinpath("06-pki").mkdir()


def _argv(
    *,
    aggregate_sha256: str,
    authorization_sha256: str,
    consumption_marker: Path,
    evidence_root: Path,
    external_roots: tuple[tuple[str, Path], ...],
    external_roots_sha256: str,
    marker_sha256: str,
    repository_roots: tuple[RepositoryRoot, ...],
    repository_roots_sha256: str,
    repository_tuple_sha256: str,
    run_id: str,
    command: str,
) -> list[str]:
    return [
        command,
        "--run-id",
        run_id,
        "--aggregate-sha256",
        aggregate_sha256,
        "--repository-tuple-sha256",
        repository_tuple_sha256,
        "--repository-roots-sha256",
        repository_roots_sha256,
        "--external-roots-sha256",
        external_roots_sha256,
        "--authorization-sha256",
        authorization_sha256,
        "--marker-sha256",
        marker_sha256,
        "--consumption-marker",
        str(consumption_marker),
        "--evidence-root",
        str(evidence_root),
        *[
            item
            for root in repository_roots
            for item in ("--repository", f"{root.repository}={root.root}")
        ],
        *[
            item
            for capability, root in external_roots
            for item in ("--external-root", f"{capability}={root}")
        ],
    ]


COMMON = _load(COMMON_PATH, "cybrik_integrated_uat_common_teardown")


def test_common_teardown_is_import_inert_and_exposes_main(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    before = sorted(tmp_path.iterdir())
    module = _load(COMMON_PATH, "cybrik_integrated_uat_common_teardown_reload")

    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""
    assert sorted(tmp_path.iterdir()) == before
    assert callable(module.main)


def test_common_teardown_uses_no_shell_and_no_broad_delete_primitives() -> None:
    source = COMMON_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])

    assert "requests" not in imported
    assert "urllib" not in imported
    assert "http" not in imported
    for forbidden in ("glob(", "rglob(", "os.walk(", "shutil.rmtree(", "shell=True"):
        assert forbidden not in source


def test_common_teardown_removes_only_bound_resources_in_reverse_order(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    repository_roots = _repository_roots(tmp_path)
    repository_roots_sha256 = repository_roots_digest(repository_roots)
    external_roots = _external_roots(tmp_path)
    external_roots_sha256 = _external_roots_digest(external_roots)
    _materialize_owned_resources(external_roots)
    evidence_root = tmp_path / "evidence"
    evidence_root.mkdir()
    consumption_marker = evidence_root / "marker.json"
    consumption_marker.write_bytes(b"consumed\n")
    marker_sha256 = hashlib.sha256(b"consumed\n").hexdigest()

    code = COMMON.main(
        _argv(
            aggregate_sha256="a" * 64,
            authorization_sha256="b" * 64,
            consumption_marker=consumption_marker,
            evidence_root=evidence_root,
            external_roots=external_roots,
            external_roots_sha256=external_roots_sha256,
            marker_sha256=marker_sha256,
            repository_roots=repository_roots,
            repository_roots_sha256=repository_roots_sha256,
            repository_tuple_sha256="c" * 64,
            run_id="integrated-uat-0001",
            command="teardown",
        )
    )

    captured = capsys.readouterr()
    assert code == 0
    assert captured.out == ""
    assert captured.err == ""
    assert COMMON.last_teardown_order == (
        "alert_context_state:06-pki",
        "alert_context_runtime:05-runtime",
        "alert_context_evidence:04-private.json",
        "postgres_d2_runtime:03-postgres",
        "postgres_d2_evidence:02-container.marker",
        "postgres_d2_runtime:01-process.marker",
    )
    for capability, root in external_roots:
        for name in (
            "01-process.marker",
            "02-container.marker",
            "03-postgres",
            "04-private.json",
            "05-runtime",
            "06-pki",
        ):
            assert not (root / name).exists()
        assert tuple(root.iterdir()) == ()


def test_common_teardown_verify_absent_emits_live_absence_proof(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    repository_roots = _repository_roots(tmp_path)
    repository_roots_sha256 = repository_roots_digest(repository_roots)
    external_roots = _external_roots(tmp_path)
    external_roots_sha256 = _external_roots_digest(external_roots)
    evidence_root = tmp_path / "evidence"
    evidence_root.mkdir()
    consumption_marker = evidence_root / "marker.json"
    consumption_marker.write_bytes(b"consumed\n")
    marker_sha256 = hashlib.sha256(b"consumed\n").hexdigest()

    code = COMMON.main(
        _argv(
            aggregate_sha256="a" * 64,
            authorization_sha256="b" * 64,
            consumption_marker=consumption_marker,
            evidence_root=evidence_root,
            external_roots=external_roots,
            external_roots_sha256=external_roots_sha256,
            marker_sha256=marker_sha256,
            repository_roots=repository_roots,
            repository_roots_sha256=repository_roots_sha256,
            repository_tuple_sha256="c" * 64,
            run_id="integrated-uat-0001",
            command="verify-absent",
        )
    )

    captured = capsys.readouterr()
    assert code == 0
    assert captured.err == ""
    assert captured.out == _canonical_json(
        {
            "absent": True,
            "aggregate_sha256": "a" * 64,
            "authorization_sha256": "b" * 64,
            "external_roots_sha256": external_roots_sha256,
            "marker_sha256": marker_sha256,
            "repository_roots_sha256": repository_roots_sha256,
            "repository_tuple_sha256": "c" * 64,
            "run_id": "integrated-uat-0001",
            "schema": "cybrik.integrated-uat.absence/v1",
            "scope": "common",
        }
    )


def test_common_teardown_refuses_symlinked_owned_resource(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    repository_roots = _repository_roots(tmp_path)
    repository_roots_sha256 = repository_roots_digest(repository_roots)
    external_roots = _external_roots(tmp_path)
    external_roots_sha256 = _external_roots_digest(external_roots)
    _materialize_owned_resources(external_roots)
    target = dict(external_roots)["postgres_d2_runtime"] / "other.marker"
    target.write_text("elsewhere", encoding="utf-8")
    marker = dict(external_roots)["postgres_d2_runtime"] / "01-process.marker"
    marker.unlink()
    marker.symlink_to(target)
    evidence_root = tmp_path / "evidence"
    evidence_root.mkdir()
    consumption_marker = evidence_root / "marker.json"
    consumption_marker.write_bytes(b"consumed\n")
    marker_sha256 = hashlib.sha256(b"consumed\n").hexdigest()

    code = COMMON.main(
        _argv(
            aggregate_sha256="a" * 64,
            authorization_sha256="b" * 64,
            consumption_marker=consumption_marker,
            evidence_root=evidence_root,
            external_roots=external_roots,
            external_roots_sha256=external_roots_sha256,
            marker_sha256=marker_sha256,
            repository_roots=repository_roots,
            repository_roots_sha256=repository_roots_sha256,
            repository_tuple_sha256="c" * 64,
            run_id="integrated-uat-0001",
            command="teardown",
        )
    )

    captured = capsys.readouterr()
    assert code == 2
    assert captured.out == ""
    assert captured.err.strip() == "resource_path_invalid"


def test_common_teardown_refuses_external_root_digest_mismatch(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    repository_roots = _repository_roots(tmp_path)
    repository_roots_sha256 = repository_roots_digest(repository_roots)
    external_roots = _external_roots(tmp_path)
    evidence_root = tmp_path / "evidence"
    evidence_root.mkdir()
    consumption_marker = evidence_root / "marker.json"
    consumption_marker.write_bytes(b"consumed\n")
    marker_sha256 = hashlib.sha256(b"consumed\n").hexdigest()

    code = COMMON.main(
        _argv(
            aggregate_sha256="a" * 64,
            authorization_sha256="b" * 64,
            consumption_marker=consumption_marker,
            evidence_root=evidence_root,
            external_roots=external_roots,
            external_roots_sha256="f" * 64,
            marker_sha256=marker_sha256,
            repository_roots=repository_roots,
            repository_roots_sha256=repository_roots_sha256,
            repository_tuple_sha256="c" * 64,
            run_id="integrated-uat-0001",
            command="verify-absent",
        )
    )

    captured = capsys.readouterr()
    assert code == 2
    assert captured.out == ""
    assert captured.err.strip() == "external_roots_mismatch"
