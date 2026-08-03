from __future__ import annotations

import ast
import importlib.util
import json
import socket
import subprocess
import sys
from pathlib import Path

import pytest

from cybrik_suite_integrated_uat.models import (
    EXPECTED_PORTS,
    EXPECTED_REPOSITORIES,
    RepositoryIdentity,
    RepositoryRoot,
    canonical_json_bytes,
    repository_roots_digest,
    repository_tuple_digest,
)

ROOT = Path(__file__).parents[1]
SCRIPTS = ROOT / "scripts"
INSPECT_PATH = SCRIPTS / "inspect_environment.py"
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


def _git(root: Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=root,
        env=ENV,
        text=True,
        capture_output=True,
        check=True,
    )
    return completed.stdout.strip()


def _create_repo(root: Path) -> tuple[str, str]:
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
    return _git(root, "rev-parse", "HEAD"), _git(root, "rev-parse", "HEAD^{tree}")


def _repository_roots(tmp_path: Path) -> tuple[RepositoryRoot, ...]:
    roots = tuple(tmp_path / "repositories" / name for name in EXPECTED_REPOSITORIES)
    for root in roots:
        _create_repo(root)
    return tuple(
        RepositoryRoot(repository=name, root=root)
        for name, root in zip(EXPECTED_REPOSITORIES, roots)
    )


def _repository_tuple(
    roots: tuple[RepositoryRoot, ...],
) -> tuple[RepositoryIdentity, ...]:
    return tuple(
        RepositoryIdentity(
            repository=root.repository,
            commit=_git(root.root, "rev-parse", "HEAD"),
            tree=_git(root.root, "rev-parse", "HEAD^{tree}"),
            clean=_git(root.root, "status", "--porcelain", "--untracked-files=no")
            == "",
        )
        for root in roots
    )


def _external_roots(tmp_path: Path) -> tuple[tuple[str, Path], ...]:
    roots = tuple(
        (capability, tmp_path / "external" / capability)
        for capability in EXTERNAL_CAPABILITIES
    )
    for _, root in roots:
        root.mkdir(parents=True)
    return roots


def _external_roots_digest(roots: tuple[tuple[str, Path], ...]) -> str:
    payload = canonical_json_bytes(
        [{"capability": capability, "root": str(root)} for capability, root in roots]
    )
    return __import__("hashlib").sha256(payload).hexdigest()


def _argv(
    *,
    aggregate_sha256: str,
    repository_tuple_sha256: str,
    repository_roots: tuple[RepositoryRoot, ...],
    repository_roots_sha256: str,
    external_roots: tuple[tuple[str, Path], ...],
    external_roots_sha256: str,
    run_id: str,
) -> list[str]:
    return [
        "inspect",
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
        *[item for port in EXPECTED_PORTS for item in ("--absent-port", str(port))],
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


INSPECT = _load(INSPECT_PATH, "cybrik_integrated_uat_inspect_environment")


def test_inspect_environment_is_import_inert_and_exposes_main(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    before = sorted(tmp_path.iterdir())
    module = _load(INSPECT_PATH, "cybrik_integrated_uat_inspect_environment_reload")

    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""
    assert sorted(tmp_path.iterdir()) == before
    assert callable(module.main)


def test_inspect_environment_uses_no_shell_and_no_http_clients() -> None:
    source = INSPECT_PATH.read_text(encoding="utf-8")
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
    assert "shell=True" not in source


def test_inspect_environment_emits_live_canonical_receipt(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    repository_roots = _repository_roots(tmp_path)
    repository_tuple = _repository_tuple(repository_roots)
    repository_tuple_sha256 = repository_tuple_digest(repository_tuple)
    repository_roots_sha256 = repository_roots_digest(repository_roots)
    external_roots = _external_roots(tmp_path)
    external_roots_sha256 = _external_roots_digest(external_roots)

    code = INSPECT.main(
        _argv(
            aggregate_sha256="a" * 64,
            repository_tuple_sha256=repository_tuple_sha256,
            repository_roots=repository_roots,
            repository_roots_sha256=repository_roots_sha256,
            external_roots=external_roots,
            external_roots_sha256=external_roots_sha256,
            run_id="integrated-uat-0001",
        )
    )

    captured = capsys.readouterr()
    assert code == 0
    assert captured.err == ""
    assert captured.out == _canonical_json(
        {
            "absent_ports": list(EXPECTED_PORTS),
            "aggregate_sha256": "a" * 64,
            "containers_absent": True,
            "external_roots_sha256": external_roots_sha256,
            "pki_absent": True,
            "postgres_absent": True,
            "private_artifacts_absent": True,
            "processes_absent": True,
            "repository_roots_sha256": repository_roots_sha256,
            "repository_tuple": [item.to_dict() for item in repository_tuple],
            "repository_tuple_sha256": repository_tuple_sha256,
            "run_id": "integrated-uat-0001",
            "runtime_artifacts_absent": True,
            "schema": "cybrik.integrated-uat.environment-inspection/v1",
        }
    )


def test_inspect_environment_fails_on_dirty_repository(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    repository_roots = _repository_roots(tmp_path)
    repository_tuple = _repository_tuple(repository_roots)
    repository_tuple_sha256 = repository_tuple_digest(repository_tuple)
    repository_roots_sha256 = repository_roots_digest(repository_roots)
    external_roots = _external_roots(tmp_path)
    external_roots_sha256 = _external_roots_digest(external_roots)
    repository_roots[0].root.joinpath("tracked.txt").write_text(
        "dirty", encoding="utf-8"
    )

    code = INSPECT.main(
        _argv(
            aggregate_sha256="a" * 64,
            repository_tuple_sha256=repository_tuple_sha256,
            repository_roots=repository_roots,
            repository_roots_sha256=repository_roots_sha256,
            external_roots=external_roots,
            external_roots_sha256=external_roots_sha256,
            run_id="integrated-uat-0001",
        )
    )

    captured = capsys.readouterr()
    assert code == 2
    assert captured.out == ""
    assert captured.err.strip() == "repository_not_clean"


def test_inspect_environment_fails_when_required_port_is_present(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    repository_roots = _repository_roots(tmp_path)
    repository_tuple = _repository_tuple(repository_roots)
    repository_tuple_sha256 = repository_tuple_digest(repository_tuple)
    repository_roots_sha256 = repository_roots_digest(repository_roots)
    external_roots = _external_roots(tmp_path)
    external_roots_sha256 = _external_roots_digest(external_roots)

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(("127.0.0.1", EXPECTED_PORTS[0]))
    listener.listen(1)
    try:
        code = INSPECT.main(
            _argv(
                aggregate_sha256="a" * 64,
                repository_tuple_sha256=repository_tuple_sha256,
                repository_roots=repository_roots,
                repository_roots_sha256=repository_roots_sha256,
                external_roots=external_roots,
                external_roots_sha256=external_roots_sha256,
                run_id="integrated-uat-0001",
            )
        )
    finally:
        listener.close()

    captured = capsys.readouterr()
    assert code == 2
    assert captured.out == ""
    assert captured.err.strip() == "port_observations_invalid"


def test_inspect_environment_refuses_nonempty_external_root(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    repository_roots = _repository_roots(tmp_path)
    repository_tuple = _repository_tuple(repository_roots)
    repository_tuple_sha256 = repository_tuple_digest(repository_tuple)
    repository_roots_sha256 = repository_roots_digest(repository_roots)
    external_roots = _external_roots(tmp_path)
    external_roots_sha256 = _external_roots_digest(external_roots)
    state_root = dict(external_roots)["alert_context_state"]
    state_root.joinpath("residual.txt").write_text("leftover", encoding="utf-8")

    code = INSPECT.main(
        _argv(
            aggregate_sha256="a" * 64,
            repository_tuple_sha256=repository_tuple_sha256,
            repository_roots=repository_roots,
            repository_roots_sha256=repository_roots_sha256,
            external_roots=external_roots,
            external_roots_sha256=external_roots_sha256,
            run_id="integrated-uat-0001",
        )
    )

    captured = capsys.readouterr()
    assert code == 2
    assert captured.out == ""
    assert captured.err.strip() == "absence_observation_invalid"
