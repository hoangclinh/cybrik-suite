from __future__ import annotations

import ast
import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

SUITE_ROOT = Path(__file__).resolve().parents[4]
SCRIPTS = SUITE_ROOT / "integration/compose/soc-ai-lifecycle-create-mtls/scripts"
PREFLIGHT_PATH = SCRIPTS / "prefounder_preflight.py"
GUIDE = (
    SUITE_ROOT
    / "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/03-pre-founder-scenario-operator-guide.md"
)


def _load(path: Path, name: str) -> object:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


PREFLIGHT = _load(PREFLIGHT_PATH, "cybrik_prefounder_preflight")


def _prerequisites(observed_at: str = "2026-08-03T00:00:00Z") -> dict[str, object]:
    return {
        "schema_version": PREFLIGHT.PREREQUISITES_SCHEMA_VERSION,
        "observed_at": observed_at,
        "docker": {
            "cli_present": True,
            "daemon_running": True,
            "images_present": list(PREFLIGHT.SCENARIO.REQUIRED_IMAGE_REFERENCES),
            "binds_free": {bind: True for bind in PREFLIGHT.SCENARIO.PROSPECTIVE_BINDS},
        },
        "tool_fabric_runtime_receipt": {"claimed_present": False},
    }


def _write_json(path: Path, value: object) -> Path:
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


def _product_observations() -> dict[str, dict[str, object]]:
    return {
        name: {
            "commit": commit,
            "tree": tree,
            "head_detached": True,
            "worktree_clean": True,
        }
        for name, (commit, tree) in PREFLIGHT.SCENARIO.PINNED_PRODUCTS.items()
    }


def test_preflight_is_import_inert_and_exposes_main(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    before = sorted(tmp_path.iterdir())
    module = _load(PREFLIGHT_PATH, "cybrik_prefounder_preflight_second_load")

    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""
    assert sorted(tmp_path.iterdir()) == before
    assert callable(module.main)


def test_preflight_has_no_runtime_or_network_imports() -> None:
    tree = ast.parse(PREFLIGHT_PATH.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])

    assert not imported & {
        "asyncio",
        "http",
        "multiprocessing",
        "requests",
        "socket",
        "ssl",
        "urllib",
    }


def test_prefounder_preflight_remains_a_dry_assessor_not_runtime_authority() -> None:
    source = PREFLIGHT_PATH.read_text(encoding="utf-8")

    assert "runtime_authorization" not in source
    assert "authorize_from_environment" not in source


def test_only_git_seam_may_call_subprocess() -> None:
    tree = ast.parse(PREFLIGHT_PATH.read_text(encoding="utf-8"))
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent

    calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "subprocess"
    ]
    assert calls
    for call in calls:
        current: ast.AST | None = call
        while current is not None and not isinstance(current, ast.FunctionDef):
            current = parents.get(current)
        assert isinstance(current, ast.FunctionDef)
        assert current.name == "_git"
        assert all(keyword.arg != "shell" for keyword in call.keywords)

    source = PREFLIGHT_PATH.read_text(encoding="utf-8")
    for forbidden in (
        "os.system(",
        "os.popen(",
        "os.exec",
        "os.spawn",
        "subprocess.Popen(",
    ):
        assert forbidden not in source


def test_git_seam_refuses_unlisted_commands(tmp_path: Path) -> None:
    with pytest.raises(PREFLIGHT.PreflightFailure, match="git_command_refused"):
        PREFLIGHT._git(tmp_path, ("checkout", "main"))


def test_git_seam_drops_caller_git_overrides_and_uses_absolute_binary(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, object] = {}

    def fake_run(command: list[str], **kwargs: object) -> SimpleNamespace:
        captured["command"] = command
        captured["env"] = kwargs["env"]
        return SimpleNamespace(returncode=0, stdout="")

    for key in (
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_COMMON_DIR",
        "GIT_CONFIG_COUNT",
        "GIT_CONFIG_KEY_0",
        "GIT_CONFIG_VALUE_0",
    ):
        monkeypatch.setenv(key, "/attacker-controlled")
    monkeypatch.setattr(PREFLIGHT.subprocess, "run", fake_run)

    PREFLIGHT._git(tmp_path, PREFLIGHT.READ_ONLY_GIT_COMMANDS[0])

    assert Path(captured["command"][0]).is_absolute()
    child_env = captured["env"]
    assert isinstance(child_env, dict)
    assert not set(child_env) & {
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_COMMON_DIR",
        "GIT_CONFIG_COUNT",
        "GIT_CONFIG_KEY_0",
        "GIT_CONFIG_VALUE_0",
    }


def test_collect_product_uses_only_frozen_read_only_git_commands(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[tuple[str, ...]] = []

    def fake_git(root: Path, args: tuple[str, ...]) -> tuple[int, str]:
        assert root == tmp_path
        calls.append(args)
        answers = {
            ("rev-parse", "--show-toplevel"): (0, str(tmp_path)),
            ("rev-parse", "--verify", "HEAD^{commit}"): (0, "a" * 40),
            ("rev-parse", "--verify", "HEAD^{tree}"): (0, "b" * 40),
            ("symbolic-ref", "--quiet", "HEAD"): (1, ""),
            ("status", "--porcelain=v1", "--untracked-files=all"): (0, ""),
        }
        return answers[args]

    monkeypatch.setattr(PREFLIGHT, "_git", fake_git)

    result = PREFLIGHT._collect_product(tmp_path)

    assert result == {
        "commit": "a" * 40,
        "tree": "b" * 40,
        "head_detached": True,
        "worktree_clean": True,
    }
    assert tuple(calls) == PREFLIGHT.READ_ONLY_GIT_COMMANDS


@pytest.mark.parametrize(
    "extra_key",
    ["products", "runtime_authorization", "execute", "fabric_endpoint"],
)
def test_prerequisites_are_closed_and_cannot_supply_identity_or_authority(
    tmp_path: Path, extra_key: str
) -> None:
    value = _prerequisites()
    value[extra_key] = {}
    path = _write_json(tmp_path / "prerequisites.json", value)

    with pytest.raises(PREFLIGHT.PreflightFailure, match="prerequisites_invalid"):
        PREFLIGHT._load_prerequisites(path)


def test_template_is_all_negative_and_never_claims_a_receipt(tmp_path: Path) -> None:
    target = tmp_path / "prerequisites.json"

    code = PREFLIGHT.main(["--emit-prerequisites-template", str(target)])

    assert code == 0
    assert target.stat().st_mode & 0o777 == 0o600
    document = json.loads(target.read_text(encoding="utf-8"))
    assert document["docker"]["cli_present"] is False
    assert document["docker"]["daemon_running"] is False
    assert document["docker"]["images_present"] == []
    assert not any(document["docker"]["binds_free"].values())
    assert document["tool_fabric_runtime_receipt"] == {"claimed_present": False}


def test_output_targets_inside_suite_are_refused(tmp_path: Path) -> None:
    with pytest.raises(PREFLIGHT.PreflightFailure, match="output_must_be_external"):
        PREFLIGHT._fresh_external_path(
            SUITE_ROOT / "forbidden.json", suite_root=SUITE_ROOT
        )


def test_existing_output_is_never_overwritten(tmp_path: Path) -> None:
    target = tmp_path / "existing.json"
    target.write_text("preserve", encoding="utf-8")

    with pytest.raises(PREFLIGHT.PreflightFailure, match="output_exists"):
        PREFLIGHT._fresh_external_path(target, suite_root=SUITE_ROOT)

    assert target.read_text(encoding="utf-8") == "preserve"


def test_summary_never_treats_an_empty_product_map_as_a_pinned_tuple(
    capsys: pytest.CaptureFixture[str],
) -> None:
    PREFLIGHT._summary(
        {
            "status": "HOLD",
            "products": {},
            "blockers": [],
            "execution_plan": {"next_step": None, "steps": []},
            "runtime_launch": {"admitted": False},
        }
    )

    assert "pinned_tuple=false" in capsys.readouterr().out


def test_all_green_non_runtime_facts_still_report_hold_and_no_launch(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    suite_root = tmp_path / "suite"
    suite_root.mkdir()
    product_roots = {
        name: tmp_path / name for name in PREFLIGHT.SCENARIO.PINNED_PRODUCTS
    }
    for root in product_roots.values():
        root.mkdir()
    prerequisites = _write_json(tmp_path / "prerequisites.json", _prerequisites())
    observations = tmp_path / "observations.json"
    report = tmp_path / "report.json"
    monkeypatch.setattr(PREFLIGHT, "BOUND_SUITE_ROOT", suite_root)
    monkeypatch.setattr(PREFLIGHT.SCENARIO, "BOUND_SUITE_ROOT", suite_root)
    monkeypatch.setattr(
        PREFLIGHT, "_collect_products", lambda _: _product_observations()
    )

    code = PREFLIGHT.main(
        [
            "--suite-root",
            str(suite_root),
            "--soc-root",
            str(product_roots["cybrik-soc-command-center"]),
            "--cyber-ai-root",
            str(product_roots["cybrik-cyber-ai-platform"]),
            "--tool-fabric-root",
            str(product_roots["cybrik-security-tool-fabric"]),
            "--prerequisites",
            str(prerequisites),
            "--observations-json",
            str(observations),
            "--report-json",
            str(report),
        ]
    )

    result = json.loads(report.read_text(encoding="utf-8"))
    output = capsys.readouterr().out
    assert code == 1
    assert result["status"] == "HOLD"
    assert result["execution"] == {"authorized": False, "runtime_executed": False}
    assert "tool_fabric_runtime_producer_absent" in result["blockers"]
    assert "tool_fabric_runtime_receipt_absent" in result["blockers"]
    assert "status=HOLD" in output
    assert output.startswith("status=HOLD\n")
    assert '{"blockers"' not in output
    assert "runtime_launch_admitted=false" in output
    assert "status=READY" not in output


def test_full_run_refuses_outputs_inside_any_product_repository(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    suite_root = tmp_path / "suite"
    suite_root.mkdir()
    product_roots = {
        name: tmp_path / name for name in PREFLIGHT.SCENARIO.PINNED_PRODUCTS
    }
    for root in product_roots.values():
        root.mkdir()
    prerequisites = _write_json(tmp_path / "prerequisites.json", _prerequisites())
    forbidden_observations = (
        product_roots["cybrik-soc-command-center"] / "observations.json"
    )
    monkeypatch.setattr(PREFLIGHT, "BOUND_SUITE_ROOT", suite_root)
    monkeypatch.setattr(PREFLIGHT.SCENARIO, "BOUND_SUITE_ROOT", suite_root)
    monkeypatch.setattr(
        PREFLIGHT, "_collect_products", lambda _: _product_observations()
    )

    code = PREFLIGHT.main(
        [
            "--suite-root",
            str(suite_root),
            "--soc-root",
            str(product_roots["cybrik-soc-command-center"]),
            "--cyber-ai-root",
            str(product_roots["cybrik-cyber-ai-platform"]),
            "--tool-fabric-root",
            str(product_roots["cybrik-security-tool-fabric"]),
            "--prerequisites",
            str(prerequisites),
            "--observations-json",
            str(forbidden_observations),
            "--report-json",
            str(tmp_path / "report.json"),
        ]
    )

    assert code == 2
    assert "output_must_be_external" in capsys.readouterr().err
    assert not forbidden_observations.exists()


def test_receipt_claim_cannot_be_manufactured_by_prerequisites(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    suite_root = tmp_path / "suite"
    suite_root.mkdir()
    product_roots = {
        name: tmp_path / name for name in PREFLIGHT.SCENARIO.PINNED_PRODUCTS
    }
    for root in product_roots.values():
        root.mkdir()
    value = _prerequisites()
    value["tool_fabric_runtime_receipt"] = {"claimed_present": True}
    prerequisites = _write_json(tmp_path / "prerequisites.json", value)
    monkeypatch.setattr(PREFLIGHT, "BOUND_SUITE_ROOT", suite_root)
    monkeypatch.setattr(PREFLIGHT.SCENARIO, "BOUND_SUITE_ROOT", suite_root)
    monkeypatch.setattr(
        PREFLIGHT, "_collect_products", lambda _: _product_observations()
    )

    code = PREFLIGHT.main(
        [
            "--suite-root",
            str(suite_root),
            "--soc-root",
            str(product_roots["cybrik-soc-command-center"]),
            "--cyber-ai-root",
            str(product_roots["cybrik-cyber-ai-platform"]),
            "--tool-fabric-root",
            str(product_roots["cybrik-security-tool-fabric"]),
            "--prerequisites",
            str(prerequisites),
            "--observations-json",
            str(tmp_path / "observations.json"),
            "--report-json",
            str(tmp_path / "report.json"),
        ]
    )

    assert code == 2
    assert "tool_fabric_runtime_receipt_claim_unbacked" in capsys.readouterr().err
    assert not (tmp_path / "report.json").exists()


def test_execute_mode_is_not_an_available_argument(
    capsys: pytest.CaptureFixture[str],
) -> None:
    code = PREFLIGHT.main(["--mode", "execute"])

    assert code == 2
    assert "arguments_invalid" in capsys.readouterr().err


def test_operator_guide_exposes_the_agent_preflight_and_keeps_runtime_refused() -> None:
    text = GUIDE.read_text(encoding="utf-8")

    assert "prefounder_preflight.py --emit-prerequisites-template" in text
    assert "prefounder_preflight.py \\" in text
    assert "--soc-root" in text
    assert "--cyber-ai-root" in text
    assert "--tool-fabric-root" in text
    assert "runtime_launch_admitted=false" in text
    assert "Do not execute `run_prefounder_integrated_uat.sh`" in text


def test_prerequisite_reader_binds_ctime_and_sets_close_on_exec() -> None:
    source = PREFLIGHT_PATH.read_text(encoding="utf-8")

    assert "st_ctime_ns" in source
    assert 'getattr(os, "O_CLOEXEC", 0)' in source


@pytest.mark.parametrize(
    "payload",
    [
        b'\xef\xbb\xbf{"schema_version":"x"}',
        b'{"schema_version":"x","schema_version":"y"}',
    ],
)
def test_prerequisite_json_rejects_bom_and_duplicate_keys(
    tmp_path: Path, payload: bytes
) -> None:
    path = tmp_path / "prerequisites.json"
    path.write_bytes(payload)

    with pytest.raises(PREFLIGHT.PreflightFailure, match="prerequisites_invalid"):
        PREFLIGHT._load_prerequisites(path)


def test_prerequisite_reader_rejects_symlinks(tmp_path: Path) -> None:
    target = _write_json(tmp_path / "target.json", _prerequisites())
    link = tmp_path / "link.json"
    link.symlink_to(target)

    with pytest.raises(PREFLIGHT.PreflightFailure, match="prerequisites_invalid"):
        PREFLIGHT._load_prerequisites(link)
