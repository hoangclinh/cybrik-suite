"""Tests for deterministic, fail-closed D1 coverage-closure recovery."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import sys
from dataclasses import replace
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "scripts" / "recover_coverage_closure.py"
SPEC = importlib.util.spec_from_file_location("recover_coverage_closure", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
recovery = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = recovery
SPEC.loader.exec_module(recovery)


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_file(path: Path) -> str:
    return _sha256_bytes(path.read_bytes())


def _closure_digest(rows: list[tuple[str, str]]) -> str:
    payload = "".join(f"{name}=={version}\n" for name, version in sorted(rows))
    return _sha256_bytes(payload.encode())


class FakeRunner:
    def __init__(
        self,
        *,
        requirements: bytes,
        wheel_payloads: dict[str, bytes],
        inventory: list[tuple[str, str]],
        fail_stage: str | None = None,
        git_branch: str = "HEAD",
        git_status: str = "",
        uv_version_output: str = "uv 0.11.16",
    ) -> None:
        self.requirements = requirements
        self.wheel_payloads = wheel_payloads
        self.inventory = inventory
        self.fail_stage = fail_stage
        self.git_branch = git_branch
        self.git_status = git_status
        self.uv_version_output = uv_version_output
        self.calls: list[tuple[list[str], Path, dict[str, str]]] = []

    def __call__(self, argv: list[str], *, cwd: Path, env: dict[str, str]) -> str:
        self.calls.append((list(argv), cwd, dict(env)))
        if argv[0] == "/usr/bin/git":
            if argv[1:] == ["rev-parse", "--show-toplevel"]:
                return str(cwd)
            if argv[1:] == ["rev-parse", "HEAD"]:
                return "a" * 40
            if argv[1:] == ["rev-parse", "HEAD^{tree}"]:
                return "b" * 40
            if argv[1:] == ["rev-parse", "--abbrev-ref", "HEAD"]:
                return self.git_branch
            if argv[1:] == ["status", "--porcelain=v1", "-uall", "--ignored"]:
                return self.git_status
        if argv[-1:] == ["--version"] and Path(argv[0]).name == "uv":
            return self.uv_version_output
        if argv[1:4] == ["-I", "-c", recovery.PYTHON_VERSION_PROBE]:
            return "3.12.13"
        if argv[1:5] == ["-I", "-m", "pip", "--version"]:
            return "pip 26.1.1 from /pinned/pip (python 3.12)"
        if "export" in argv:
            if self.fail_stage == "export":
                raise recovery.RecoveryFailure("command_failed")
            Path(argv[argv.index("--output-file") + 1]).write_bytes(self.requirements)
            return ""
        if "download" in argv:
            if self.fail_stage == "download":
                raise recovery.RecoveryFailure("command_failed")
            destination = Path(argv[argv.index("--dest") + 1])
            for filename, payload in self.wheel_payloads.items():
                (destination / filename).write_bytes(payload)
            return ""
        if "venv" in argv:
            if self.fail_stage == "venv":
                raise recovery.RecoveryFailure("command_failed")
            venv = Path(argv[-1])
            (venv / "bin").mkdir(parents=True)
            (venv / "bin" / "python3.12").symlink_to(
                Path(argv[argv.index("--python") + 1])
            )
            target = (
                "python3.11" if self.fail_stage == "venv_identity" else "python3.12"
            )
            (venv / "bin" / "python").symlink_to(target)
            return ""
        if "sync" in argv:
            if self.fail_stage == "sync":
                raise recovery.RecoveryFailure("command_failed")
            return ""
        if argv[1:3] == ["-I", "-c"] and argv[3] == recovery.INVENTORY_PROBE:
            if self.fail_stage == "inventory":
                return "not-json"
            if self.fail_stage == "requirements_rebind":
                Path(argv[0]).parents[2].joinpath("requirements.txt").write_bytes(
                    b"changed-after-verification\n"
                )
            return json.dumps(self.inventory, separators=(",", ":"))
        raise AssertionError(f"unexpected command: {argv!r}")


@pytest.fixture
def recovery_fixture(
    tmp_path: Path,
) -> tuple[
    object,
    object,
    FakeRunner,
    bytes,
    dict[str, bytes],
    list[tuple[str, str]],
]:
    suite = tmp_path / "suite"
    harness = suite / "integration" / "compose" / "soc-ai-lifecycle-create-mtls"
    evidence_directory = harness / "evidence"
    evidence_directory.mkdir(parents=True)

    requirements = b"alpha==1 --hash=sha256:abc\nbeta==2 --hash=sha256:def\n"
    wheel_payloads = {
        "alpha-1-py3-none-any.whl": b"alpha-wheel",
        "beta-2-py3-none-any.whl": b"beta-wheel",
    }
    lock_rows = []
    for filename, payload in sorted(wheel_payloads.items()):
        name = filename.split("-", 1)[0]
        digest = _sha256_bytes(payload)
        wheel_row = (
            f'  {{ url = "https://files.pythonhosted.org/packages/test/{filename}", '
            f'hash = "sha256:{digest}", size = {len(payload)} }},'
        )
        lock_rows.append(
            "\n".join(
                (
                    "[[package]]",
                    f'name = "{name}"',
                    'version = "1"',
                    'source = { registry = "https://pypi.org/simple" }',
                    "wheels = [",
                    wheel_row,
                    "]",
                )
            )
        )
    (harness / "uv.lock").write_text(
        "version = 1\nrevision = 3\n" + "\n\n".join(lock_rows) + "\n",
        encoding="utf-8",
    )
    lock_evidence = {
        "uv_version": "0.11.16",
        "python_executable": str(tmp_path / "tools" / "python3.12"),
        "python_executable_sha256": "placeholder",
        "python_version": "3.12.13",
        "pip_version": "26.1.1",
        "index_url": "https://pypi.org/simple",
        "requirements_sha256": _sha256_bytes(requirements),
        "uv_lock_sha256": _sha256_file(harness / "uv.lock"),
        "wheel_count": 2,
        "wheels": [
            {"filename": name, "sha256": _sha256_bytes(payload)}
            for name, payload in sorted(wheel_payloads.items())
        ],
    }
    (evidence_directory / "dependency-lock.json").write_text(
        json.dumps(lock_evidence), encoding="utf-8"
    )

    tools = tmp_path / "tools"
    tools.mkdir(exist_ok=True)
    uv = tools / "uv"
    python = tools / "python3.12"
    uv.write_bytes(b"uv-binary")
    python.write_bytes(b"python-binary")
    uv.chmod(0o700)
    python.chmod(0o700)
    lock_evidence["python_executable_sha256"] = _sha256_file(python)
    (evidence_directory / "dependency-lock.json").write_text(
        json.dumps(lock_evidence), encoding="utf-8"
    )

    closure_parent = tmp_path / "durable-closures"
    evidence_parent = tmp_path / "durable-evidence"
    closure_parent.mkdir(mode=0o700)
    evidence_parent.mkdir(mode=0o700)
    paths = recovery.RecoveryPaths(
        suite_root=suite,
        suite_commit="a" * 40,
        suite_tree="b" * 40,
        closure_root=closure_parent / "d2-cov-closure-r1",
        evidence_root=evidence_parent / "d2-cov-closure-evidence-r1",
    )
    inventory = [("cryptography", "50.0.0"), ("pytest", "9.1.1")]
    pins = recovery.RecoveryPins(
        uv_path=uv,
        uv_sha256=_sha256_file(uv),
        uv_version="0.11.16",
        python_path=python,
        python_sha256=_sha256_file(python),
        python_version="3.12.13",
        pip_version="26.1.1",
        lock_sha256=_sha256_file(harness / "uv.lock"),
        requirements_sha256=_sha256_bytes(requirements),
        wheel_count=2,
        closure_sha256=_closure_digest(inventory),
        pytest_version="9.1.1",
        cryptography_version="50.0.0",
        index_url="https://pypi.org/simple",
    )
    runner = FakeRunner(
        requirements=requirements,
        wheel_payloads=wheel_payloads,
        inventory=inventory,
    )
    return paths, pins, runner, requirements, wheel_payloads, inventory


def test_check_only_validates_exact_plan_without_writes_or_network(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
) -> None:
    paths, pins, runner, _, _, _ = recovery_fixture
    before = sorted(str(path) for path in paths.suite_root.parent.rglob("*"))

    result = recovery.run_recovery(
        paths,
        mode="check-only",
        pins=pins,
        runner=runner,
        forbidden_roots=(),
    )

    after = sorted(str(path) for path in paths.suite_root.parent.rglob("*"))
    assert before == after
    assert result["status"] == "checked_not_executed"
    assert len(runner.calls) == 8
    assert all(
        "export" not in argv and "download" not in argv and "sync" not in argv
        for argv, _, _ in runner.calls
    )


def test_check_only_accepts_pinned_homebrew_uv_build_annotation(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
) -> None:
    paths, pins, runner, _, _, _ = recovery_fixture
    runner.uv_version_output = "uv 0.11.16 (Homebrew 2026-05-21 aarch64-apple-darwin)"

    result = recovery.run_recovery(
        paths,
        mode="check-only",
        pins=pins,
        runner=runner,
        forbidden_roots=(),
    )

    assert result["status"] == "checked_not_executed"


@pytest.mark.parametrize(
    "version_output",
    [
        "uv 0.11.17 (Homebrew 2026-05-21 aarch64-apple-darwin)",
        "uv 0.11.16 (untrusted build)",
        "uv 0.11.16 trailing",
    ],
)
def test_check_only_rejects_unpinned_uv_version_annotations(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
    version_output: str,
) -> None:
    paths, pins, runner, _, _, _ = recovery_fixture
    runner.uv_version_output = version_output

    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.run_recovery(
            paths,
            mode="check-only",
            pins=pins,
            runner=runner,
            forbidden_roots=(),
        )

    assert error.value.reason == "uv_version_mismatch"


def test_plan_uses_exact_locked_export_download_no_seed_and_offline_sync(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
) -> None:
    paths, pins, runner, _, _, _ = recovery_fixture
    plan = recovery.preflight(paths, pins=pins, runner=runner, forbidden_roots=())

    export = plan.commands["export"]
    assert export[:3] == [str(pins.uv_path), "export", "--format"]
    assert "--locked" in export
    assert "--no-emit-project" in export
    assert "--no-emit-local" in export
    assert "--no-sources" in export
    assert export[export.index("--group") + 1] == "test"
    assert "--no-config" in export and "--no-cache" in export

    download = plan.commands["download"]
    assert download[:6] == [
        str(pins.python_path),
        "-I",
        "-m",
        "pip",
        "--isolated",
        "download",
    ]
    assert "--require-hashes" in download
    assert download[download.index("--only-binary") + 1] == ":all:"
    assert download[download.index("--index-url") + 1] == pins.index_url
    assert "--no-cache-dir" in download and "--no-input" in download

    venv = plan.commands["venv"]
    assert venv[:2] == [str(pins.uv_path), "venv"]
    assert "--seed" not in venv
    assert "--no-python-downloads" in venv
    assert venv[venv.index("--python") + 1] == str(pins.python_path)

    sync = plan.commands["sync"]
    assert sync[:3] == [str(pins.uv_path), "pip", "sync"]
    assert "--no-index" in sync
    assert "--require-hashes" in sync
    assert "--strict" in sync
    assert sync[sync.index("--find-links") + 1] == str(
        paths.closure_root / "wheelhouse"
    )


def test_execute_builds_and_verifies_exact_closure_and_preserved_evidence(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
) -> None:
    paths, pins, runner, requirements, wheel_payloads, _ = recovery_fixture

    result = recovery.run_recovery(
        paths,
        mode="execute",
        pins=pins,
        runner=runner,
        forbidden_roots=(),
    )

    assert result["status"] == "verified"
    assert result["wheel_count"] == 2
    assert result["closure_sha256"] == pins.closure_sha256
    assert (paths.closure_root / "requirements.txt").read_bytes() == requirements
    assert sorted(
        path.name for path in (paths.closure_root / "wheelhouse").iterdir()
    ) == sorted(wheel_payloads)
    evidence = json.loads(
        (paths.evidence_root / "recovery-result.json").read_text(encoding="utf-8")
    )
    assert evidence == result
    result_payload = (paths.evidence_root / "recovery-result.json").read_bytes()
    assert (paths.evidence_root / "recovery-result.sha256").read_text(
        encoding="utf-8"
    ) == f"{_sha256_bytes(result_payload)}\n"
    assert (paths.evidence_root / "requirements.txt").read_bytes() == requirements
    assert result["commands"]
    assert result["attempt_id"]
    assert result["started_at"] <= result["completed_at"]
    assert result["tools"]["uv"]["sha256"] == pins.uv_sha256
    assert result["tools"]["python"]["sha256"] == pins.python_sha256
    assert result["root_identity"] == {
        "st_dev": paths.closure_root.stat().st_dev,
        "st_ino": paths.closure_root.stat().st_ino,
    }
    assert result["suite"] == {
        "commit": "a" * 40,
        "head_mode": "detached",
        "root": str(paths.suite_root),
        "status": "",
        "tree": "b" * 40,
    }
    wheel_manifest = json.loads(
        (paths.evidence_root / "wheel-manifest.json").read_text(encoding="utf-8")
    )
    assert all(
        row["url"].startswith("https://files.pythonhosted.org/packages/")
        for row in wheel_manifest
    )

    execution_calls = runner.calls[8:]
    assert execution_calls
    for argv, cwd, env in execution_calls:
        assert Path(argv[0]).is_absolute()
        expected_cwd = (
            paths.suite_root
            if argv[0] == "/usr/bin/git"
            else paths.suite_root / recovery.HARNESS_RELATIVE
        )
        assert cwd == expected_cwd
        assert env == recovery.SANITIZED_ENV


@pytest.mark.parametrize(
    ("mutation", "reason"),
    [
        ("missing", "wheelhouse_mismatch"),
        ("extra", "wheelhouse_mismatch"),
        ("hash", "wheel_hash_mismatch"),
        ("symlink", "wheelhouse_mismatch"),
    ],
)
def test_wheelhouse_verification_rejects_missing_extra_changed_and_symlinked_files(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
    mutation: str,
    reason: str,
) -> None:
    paths, pins, runner, _, wheel_payloads, _ = recovery_fixture
    plan = recovery.preflight(paths, pins=pins, runner=runner, forbidden_roots=())
    wheelhouse = paths.closure_root.parent / "wheelhouse-test"
    wheelhouse.mkdir()
    for filename, payload in wheel_payloads.items():
        (wheelhouse / filename).write_bytes(payload)
    if mutation == "missing":
        next(iter(wheelhouse.iterdir())).unlink()
    elif mutation == "extra":
        (wheelhouse / "extra.whl").write_bytes(b"extra")
    elif mutation == "hash":
        next(iter(wheelhouse.iterdir())).write_bytes(b"changed")
    else:
        target = next(iter(wheelhouse.iterdir()))
        target.unlink()
        target.symlink_to("missing.whl")

    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.verify_wheelhouse(wheelhouse, plan.expected_wheels)
    assert error.value.reason == reason


@pytest.mark.parametrize(
    "inventory",
    [
        [("cryptography", "50.0.0")],
        [("cryptography", "50.0.0"), ("pytest", "9.1.1"), ("coverage", "7.15.2")],
        [("cryptography", "49.0.0"), ("pytest", "9.1.1")],
        [("cryptography", "50.0.0"), ("pytest", "9.1.1"), ("pytest", "9.1.1")],
    ],
)
def test_installed_inventory_fails_closed_on_count_forbidden_version_or_duplicate(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
    inventory: list[tuple[str, str]],
) -> None:
    _, pins, _, _, _, _ = recovery_fixture
    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.verify_inventory(inventory, pins)
    assert error.value.reason == "installed_closure_mismatch"


def test_root_validation_rejects_temp_repo_overlap_preexisting_and_unsafe_parent(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
    tmp_path: Path,
) -> None:
    paths, _, _, _, _, _ = recovery_fixture
    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.validate_root_requests(
            replace(
                paths,
                closure_root=paths.suite_root / "d2-cov-closure-bad",
            ),
            forbidden_roots=(),
        )
    assert error.value.reason == "root_overlap"

    paths.closure_root.mkdir()
    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.validate_root_requests(paths, forbidden_roots=())
    assert error.value.reason == "root_not_fresh"
    paths.closure_root.rmdir()

    paths.closure_root.parent.chmod(0o770)
    try:
        with pytest.raises(recovery.RecoveryFailure) as error:
            recovery.validate_root_requests(paths, forbidden_roots=())
        assert error.value.reason == "root_parent_unsafe"
    finally:
        paths.closure_root.parent.chmod(0o700)

    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.validate_root_requests(paths, forbidden_roots=(tmp_path,))
    assert error.value.reason == "root_under_forbidden_location"


def test_execute_rolls_back_only_fresh_identity_bound_closure_and_preserves_evidence(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
) -> None:
    paths, pins, _runner, requirements, wheel_payloads, inventory = recovery_fixture
    failing = FakeRunner(
        requirements=requirements,
        wheel_payloads=wheel_payloads,
        inventory=inventory,
        fail_stage="sync",
    )

    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.run_recovery(
            paths,
            mode="execute",
            pins=pins,
            runner=failing,
            forbidden_roots=(),
        )
    assert error.value.reason == "command_failed"
    assert not paths.closure_root.exists()
    assert paths.evidence_root.is_dir()
    failure = json.loads(
        (paths.evidence_root / "recovery-failure.json").read_text(encoding="utf-8")
    )
    assert failure["reason"] == "command_failed"
    assert failure["rollback_status"] == "removed"
    assert failure["status"] == "failed"
    assert failure["attempt_id"]
    assert failure["started_at"] <= failure["failed_at"]


@pytest.mark.parametrize(
    ("fail_stage", "reason"),
    [
        ("requirements_rebind", "requirements_identity_mismatch"),
        ("venv_identity", "venv_identity_mismatch"),
    ],
)
def test_execute_rejects_post_export_requirement_drift_and_wrong_venv_identity(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
    fail_stage: str,
    reason: str,
) -> None:
    paths, pins, _, requirements, wheel_payloads, inventory = recovery_fixture
    failing = FakeRunner(
        requirements=requirements,
        wheel_payloads=wheel_payloads,
        inventory=inventory,
        fail_stage=fail_stage,
    )

    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.run_recovery(
            paths,
            mode="execute",
            pins=pins,
            runner=failing,
            forbidden_roots=(),
        )
    assert error.value.reason == reason
    assert not paths.closure_root.exists()
    assert paths.evidence_root.is_dir()
    failure = json.loads(
        (paths.evidence_root / "recovery-failure.json").read_text(encoding="utf-8")
    )
    assert failure["rollback_status"] == "removed"


def test_identity_bound_rollback_refuses_rebound_path(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
) -> None:
    paths, _, _, _, _, _ = recovery_fixture
    handle = recovery.create_fresh_root(paths.closure_root)
    (paths.closure_root / "owned.txt").write_bytes(b"owned")
    moved = paths.closure_root.with_name(paths.closure_root.name + "-moved")
    paths.closure_root.rename(moved)
    paths.closure_root.mkdir(mode=0o700)
    (paths.closure_root / "foreign.txt").write_bytes(b"foreign")

    recovery.rollback_closure(handle)
    handle.close()

    assert (paths.closure_root / "foreign.txt").read_bytes() == b"foreign"
    assert (moved / "owned.txt").read_bytes() == b"owned"


def test_preflight_rejects_tool_identity_and_dependency_evidence_drift(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
) -> None:
    paths, pins, runner, _, _, _ = recovery_fixture
    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.preflight(
            paths,
            pins=replace(pins, uv_sha256="0" * 64),
            runner=runner,
            forbidden_roots=(),
        )
    assert error.value.reason == "uv_identity_mismatch"

    dependency_lock = (
        paths.suite_root
        / recovery.HARNESS_RELATIVE
        / "evidence"
        / "dependency-lock.json"
    )
    payload = json.loads(dependency_lock.read_text(encoding="utf-8"))
    payload["requirements_sha256"] = "0" * 64
    dependency_lock.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.preflight(paths, pins=pins, runner=runner, forbidden_roots=())
    assert error.value.reason == "dependency_evidence_mismatch"

    payload = json.loads(dependency_lock.read_text(encoding="utf-8"))
    payload["requirements_sha256"] = pins.requirements_sha256
    payload["wheel_count"] = 999
    dependency_lock.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.preflight(paths, pins=pins, runner=runner, forbidden_roots=())
    assert error.value.reason == "dependency_evidence_mismatch"


@pytest.mark.parametrize(
    ("branch", "status"),
    [("main", ""), ("HEAD", "?? ignored-residue")],
)
def test_preflight_rejects_attached_or_dirty_checkout(
    recovery_fixture: tuple[object, object, FakeRunner, bytes, dict[str, bytes], list],
    branch: str,
    status: str,
) -> None:
    paths, pins, runner, _, _, _ = recovery_fixture
    runner.git_branch = branch
    runner.git_status = status

    with pytest.raises(recovery.RecoveryFailure) as error:
        recovery.preflight(paths, pins=pins, runner=runner, forbidden_roots=())
    assert error.value.reason == "suite_state_mismatch"


def test_sanitized_environment_drops_proxy_path_home_and_python_injection() -> None:
    assert recovery.SANITIZED_ENV == {
        "LANG": "C",
        "LC_ALL": "C",
        "PATH": "/usr/bin:/bin",
        "PIP_CONFIG_FILE": os.devnull,
        "PIP_DISABLE_PIP_VERSION_CHECK": "1",
        "PIP_NO_INPUT": "1",
        "PYTHONNOUSERSITE": "1",
    }


def test_default_pins_are_the_reviewed_exact_d1_closure() -> None:
    assert recovery.DEFAULT_CLOSURE_ROOT == Path(
        "/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-r1"
    )
    assert recovery.DEFAULT_EVIDENCE_ROOT == Path(
        "/Users/hoanglinh/.local/share/cybrik-uat/d2-cov-closure-evidence-r1"
    )
    assert recovery.DEFAULT_PINS.uv_path == Path("/opt/homebrew/bin/uv")
    assert recovery.DEFAULT_PINS.uv_version == "0.11.16"
    assert (
        recovery.DEFAULT_PINS.uv_sha256
        == "96e422f83fd306848446170d97c1d1af8290f00e4aacfa7134e130280d573126"
    )
    assert recovery.DEFAULT_PINS.python_path == Path(
        "/Users/hoanglinh/.local/share/uv/python/cpython-3.12.13-macos-aarch64-none/bin/python3.12"
    )
    assert (
        recovery.DEFAULT_PINS.python_sha256
        == "a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623"
    )
    assert (
        recovery.DEFAULT_PINS.lock_sha256
        == "e05c5e281e230b2089e356d716212a6d2c2e4320a3a30dc8dfd126216faa3add"
    )
    assert (
        recovery.DEFAULT_PINS.requirements_sha256
        == "93ec6936e7999ee68e04434b563581ccc5a2e3b4010e252554048b7f75bf1603"
    )
    assert recovery.DEFAULT_PINS.wheel_count == 56
    assert (
        recovery.DEFAULT_PINS.closure_sha256
        == "6d6937112e7598ed13e21a96573c9e57c20dbb5df5d986670252391a40c5f919"
    )
    assert recovery.FORBIDDEN_DISTRIBUTIONS == {
        "anycorn",
        "coverage",
        "pip",
        "setuptools",
        "wheel",
    }
