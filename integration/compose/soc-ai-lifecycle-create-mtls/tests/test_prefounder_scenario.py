"""Contract tests for the pre-Founder UAT scenario runner.

The runner under test is pure stdlib, import-inert and observation-driven: it
probes nothing, opens nothing and executes nothing. These tests import it by
path and call ``main`` in-process. No subprocess, socket, Docker, stack, git
mutation or network action is performed here.
"""

from __future__ import annotations

import ast
import hashlib
import importlib.util
import json
import os
import re
import stat
import sys
from pathlib import Path

import pytest

HARNESS_ROOT = Path(__file__).parents[1]
SUITE_ROOT = HARNESS_ROOT.parents[2]
SCRIPT = HARNESS_ROOT / "scripts" / "prefounder_uat_scenario.py"
PACKAGE = HARNESS_ROOT / "src" / "cybrik_suite_uat_mtls"
ARCHITECTURE_DOC = (
    SUITE_ROOT
    / "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1"
    / "evidence/02-architecture-and-acceptance.md"
)
ALLOWED_IMPORTS = frozenset(
    {"__future__", "hashlib", "json", "os", "re", "sys", "pathlib", "typing"}
)
FORBIDDEN_IMPORTS = frozenset(
    {
        "asyncio",
        "ctypes",
        "http",
        "multiprocessing",
        "pty",
        "shutil",
        "signal",
        "socket",
        "ssl",
        "subprocess",
        "tempfile",
        "urllib",
    }
)
OBSERVED_AT = "2026-08-03T00:00:00Z"


def _load_scenario_module() -> object:
    spec = importlib.util.spec_from_file_location(
        "cybrik_prefounder_uat_scenario", SCRIPT
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


SCENARIO = _load_scenario_module()


def _constant_node(source_path: Path, name: str) -> ast.expr:
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    for node in tree.body:
        targets: list[ast.expr] = []
        if isinstance(node, ast.Assign):
            targets = list(node.targets)
        elif isinstance(node, ast.AnnAssign):
            targets = [node.target]
        if not any(
            isinstance(target, ast.Name) and target.id == name for target in targets
        ):
            continue
        value = node.value
        assert value is not None
        if isinstance(value, ast.Call):
            value = value.args[0]
        return value
    raise AssertionError(f"{name} not found in {source_path.name}")


def _observations() -> dict[str, object]:
    return {
        "schema_version": SCENARIO.OBSERVATIONS_SCHEMA_VERSION,
        "observed_at": OBSERVED_AT,
        "products": {
            name: {
                "commit": commit,
                "tree": tree,
                "head_detached": True,
                "worktree_clean": True,
            }
            for name, (commit, tree) in SCENARIO.PINNED_PRODUCTS.items()
        },
        "docker": {
            "cli_present": True,
            "daemon_running": True,
            "images_present": list(SCENARIO.REQUIRED_IMAGE_REFERENCES),
            "binds_free": {bind: True for bind in SCENARIO.PROSPECTIVE_BINDS},
        },
        "tool_fabric_runtime_receipt": {"claimed_present": False},
    }


def _roots(tmp_path: Path) -> tuple[Path, Path]:
    suite_root = tmp_path / "suite"
    suite_root.mkdir()
    SCENARIO.BOUND_SUITE_ROOT = suite_root
    return suite_root, tmp_path / "scenario-report.json"


def _write_observations(tmp_path: Path, observations: object) -> Path:
    path = tmp_path / "observations.json"
    if isinstance(observations, (bytes, str)):
        path.write_bytes(
            observations
            if isinstance(observations, bytes)
            else observations.encode("utf-8")
        )
        return path
    path.write_text(json.dumps(observations), encoding="utf-8")
    return path


def _run(
    suite_root: Path,
    observations_path: Path,
    report_path: Path,
    *extra: str,
) -> int:
    return SCENARIO.main(
        [
            "--suite-root",
            str(suite_root),
            "--observations",
            str(observations_path),
            "--report-json",
            str(report_path),
            *extra,
        ]
    )


def _assess(
    tmp_path: Path, observations: object, *extra: str
) -> tuple[int, Path, Path]:
    suite_root, report_path = _roots(tmp_path)
    observations_path = _write_observations(tmp_path, observations)
    code = _run(suite_root, observations_path, report_path, *extra)
    return code, suite_root, report_path


# ---------------------------------------------------------------------------
# Shape: pure stdlib, import-inert, frozen vocabulary
# ---------------------------------------------------------------------------


def test_scenario_runner_imports_only_allowlisted_stdlib_modules() -> None:
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            assert node.level == 0
            assert node.module is not None
            imported.add(node.module.split(".")[0])

    assert imported <= ALLOWED_IMPORTS
    assert not imported & FORBIDDEN_IMPORTS


def test_scenario_module_body_is_declarations_and_one_main_guard() -> None:
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    guards = 0
    for node in tree.body:
        if isinstance(
            node,
            (
                ast.Import,
                ast.ImportFrom,
                ast.Assign,
                ast.AnnAssign,
                ast.FunctionDef,
                ast.ClassDef,
            ),
        ):
            continue
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant):
            continue
        assert isinstance(node, ast.If)
        assert ast.unparse(node.test) == "__name__ == '__main__'"
        guards += 1

    assert guards == 1


def test_importing_the_scenario_runner_produces_no_output_and_no_files(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    before = sorted(tmp_path.iterdir())

    module = _load_scenario_module()

    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""
    assert sorted(tmp_path.iterdir()) == before
    assert callable(module.main)


def test_frozen_output_vocabulary_is_exact() -> None:
    assert SCENARIO.SCHEMA_VERSION == "CYBRIK-D2-PREFOUNDER-SCENARIO/v1"
    assert SCENARIO.OBSERVATIONS_SCHEMA_VERSION == (
        "CYBRIK-D2-PREFOUNDER-OBSERVATIONS/v1"
    )
    assert SCENARIO.FROZEN_STATUSES == ("HOLD", "READY")
    assert SCENARIO.FROZEN_BLOCKERS == (
        "docker_cli_absent",
        "docker_daemon_not_running",
        "docker_image_missing",
        "loopback_bind_occupied",
        "product_head_not_detached",
        "product_identity_mismatch",
        "product_worktree_not_clean",
        "tool_fabric_runtime_receipt_absent",
    )
    assert SCENARIO.FROZEN_FAILURE_REASONS == (
        "arguments_invalid",
        "execute_mode_not_authored",
        "observations_json_invalid",
        "observations_json_too_large",
        "observations_receipt_claim_contradicts_tree",
        "observations_schema_invalid",
        "observations_schema_version_mismatch",
        "report_json_exists",
        "report_json_must_be_outside_suite",
        "report_json_write_failed",
        "suite_root_invalid",
        "suite_root_identity_mismatch",
        "tool_fabric_runtime_receipt_claim_unbacked",
        "tool_fabric_runtime_receipt_digest_mismatch",
        "tool_fabric_runtime_receipt_not_admitted",
        "vocabulary_violation",
    )
    assert sorted(SCENARIO.FROZEN_BLOCKERS) == list(SCENARIO.FROZEN_BLOCKERS)
    assert sorted(SCENARIO.FROZEN_FAILURE_REASONS) == list(
        SCENARIO.FROZEN_FAILURE_REASONS
    )


# ---------------------------------------------------------------------------
# Pins are bound to their existing sources, not re-invented
# ---------------------------------------------------------------------------


def test_pinned_product_identities_match_the_committed_architecture_table() -> None:
    text = ARCHITECTURE_DOC.read_text(encoding="utf-8")
    row = re.compile(
        r"^\|\s*`(cybrik-[a-z-]+)`\s*\|\s*`([0-9a-f]{40})`\s*\|\s*`([0-9a-f]{40})`\s*\|$",
        re.MULTILINE,
    )
    table = {name: (commit, tree) for name, commit, tree in row.findall(text)}

    assert set(SCENARIO.PINNED_PRODUCTS) == {
        "cybrik-cyber-ai-platform",
        "cybrik-security-tool-fabric",
        "cybrik-soc-command-center",
    }
    for name, identity in SCENARIO.PINNED_PRODUCTS.items():
        assert table[name] == identity


def test_pinned_postgres_image_matches_the_harness_store_constant() -> None:
    store_image = ast.literal_eval(
        _constant_node(PACKAGE / "store.py", "POSTGRES_IMAGE")
    )

    assert SCENARIO.REQUIRED_IMAGE_REFERENCES == (store_image,)


def test_pinned_prospective_binds_match_the_harness_policy_constant() -> None:
    proposed = _constant_node(PACKAGE / "policy.py", "PROPOSED_BINDS")
    assert isinstance(proposed, ast.Dict)
    binds = [ast.literal_eval(value) for value in proposed.values]

    assert SCENARIO.PROSPECTIVE_BINDS == tuple(sorted(binds))


# ---------------------------------------------------------------------------
# READY is unreachable: no Tool Fabric runtime receipt is admitted
# ---------------------------------------------------------------------------


def test_all_green_observations_still_derive_hold_on_absent_receipt(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert report["status"] == "HOLD"
    assert report["blockers"] == ["tool_fabric_runtime_receipt_absent"]
    assert report["schema_version"] == SCENARIO.SCHEMA_VERSION
    assert report["observed_at"] == OBSERVED_AT
    assert report["mode"] == "assess"
    assert report["execution"] == {"authorized": False, "runtime_executed": False}
    assert report["tool_fabric_runtime_receipt"] == {
        "admitted_digest_pinned": False,
        "claimed_present": False,
        "present_in_tree": False,
    }
    assert (
        capsys.readouterr().out
        == json.dumps(report, sort_keys=True, separators=(",", ":")) + "\n"
    )


def test_no_receipt_digest_is_admitted_so_ready_cannot_be_derived() -> None:
    assert SCENARIO.ADMITTED_TOOL_FABRIC_RECEIPT_SHA256 is None


def test_pinned_receipt_artifact_is_absent_from_the_committed_tree() -> None:
    assert not (SUITE_ROOT / SCENARIO.TOOL_FABRIC_RECEIPT_REL).exists()


def test_receipt_presence_claim_without_a_backing_artifact_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    observations = _observations()
    observations["tool_fabric_runtime_receipt"] = {"claimed_present": True}

    code, _, report_path = _assess(tmp_path, observations)

    assert code == 2
    assert capsys.readouterr().err.strip() == (
        "tool_fabric_runtime_receipt_claim_unbacked"
    )
    assert not report_path.exists()


def test_receipt_presence_claim_with_unadmitted_artifact_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    suite_root, report_path = _roots(tmp_path)
    receipt = suite_root / SCENARIO.TOOL_FABRIC_RECEIPT_REL
    receipt.parent.mkdir(parents=True)
    receipt.write_text("{}", encoding="utf-8")
    observations = _observations()
    observations["tool_fabric_runtime_receipt"] = {"claimed_present": True}
    observations_path = _write_observations(tmp_path, observations)

    code = _run(suite_root, observations_path, report_path)

    assert code == 2
    assert capsys.readouterr().err.strip() == (
        "tool_fabric_runtime_receipt_not_admitted"
    )
    assert not report_path.exists()


def test_admitted_receipt_digest_must_match_exact_artifact_bytes(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    suite_root, report_path = _roots(tmp_path)
    receipt = suite_root / SCENARIO.TOOL_FABRIC_RECEIPT_REL
    receipt.parent.mkdir(parents=True)
    receipt.write_bytes(b"reviewed-receipt-bytes")
    monkeypatch.setattr(
        SCENARIO,
        "ADMITTED_TOOL_FABRIC_RECEIPT_SHA256",
        hashlib.sha256(b"different-receipt-bytes").hexdigest(),
    )
    observations = _observations()
    observations["tool_fabric_runtime_receipt"] = {"claimed_present": True}
    observations_path = _write_observations(tmp_path, observations)

    code = _run(suite_root, observations_path, report_path)

    assert code == 2
    assert capsys.readouterr().err.strip() == (
        "tool_fabric_runtime_receipt_digest_mismatch"
    )
    assert not report_path.exists()


def test_matching_admitted_receipt_digest_is_reported_as_pinned(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    suite_root, report_path = _roots(tmp_path)
    receipt = suite_root / SCENARIO.TOOL_FABRIC_RECEIPT_REL
    receipt.parent.mkdir(parents=True)
    receipt_bytes = b"reviewed-receipt-bytes"
    receipt.write_bytes(receipt_bytes)
    monkeypatch.setattr(
        SCENARIO,
        "ADMITTED_TOOL_FABRIC_RECEIPT_SHA256",
        hashlib.sha256(receipt_bytes).hexdigest(),
    )
    observations = _observations()
    observations["tool_fabric_runtime_receipt"] = {"claimed_present": True}
    observations_path = _write_observations(tmp_path, observations)

    code = _run(suite_root, observations_path, report_path)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 0
    assert report["status"] == "READY"
    assert report["tool_fabric_runtime_receipt"] == {
        "admitted_digest_pinned": True,
        "claimed_present": True,
        "present_in_tree": True,
    }


def test_absence_claim_contradicted_by_the_tree_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    suite_root, report_path = _roots(tmp_path)
    receipt = suite_root / SCENARIO.TOOL_FABRIC_RECEIPT_REL
    receipt.parent.mkdir(parents=True)
    receipt.write_text("{}", encoding="utf-8")
    observations_path = _write_observations(tmp_path, _observations())

    code = _run(suite_root, observations_path, report_path)

    assert code == 2
    assert capsys.readouterr().err.strip() == (
        "observations_receipt_claim_contradicts_tree"
    )
    assert not report_path.exists()


# ---------------------------------------------------------------------------
# Three-product identity, detached HEAD and clean worktree
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("field", "value", "blocker"),
    (
        ("commit", "0" * 40, "product_identity_mismatch"),
        ("tree", "0" * 40, "product_identity_mismatch"),
        ("head_detached", False, "product_head_not_detached"),
        ("worktree_clean", False, "product_worktree_not_clean"),
    ),
)
@pytest.mark.parametrize(
    "product",
    (
        "cybrik-cyber-ai-platform",
        "cybrik-security-tool-fabric",
        "cybrik-soc-command-center",
    ),
)
def test_each_product_degradation_adds_its_exact_blocker(
    tmp_path: Path, product: str, field: str, value: object, blocker: str
) -> None:
    observations = _observations()
    products = observations["products"]
    assert isinstance(products, dict)
    products[product][field] = value

    code, _, report_path = _assess(tmp_path, observations)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert report["status"] == "HOLD"
    assert blocker in report["blockers"]
    assert report["products"][product] == {
        "identity_matches": field not in {"commit", "tree"},
        "head_detached": field != "head_detached",
        "worktree_clean": field != "worktree_clean",
    }


@pytest.mark.parametrize(
    "mutate",
    (
        pytest.param(lambda products: products.pop("cybrik-cyber-ai-platform"), id="m"),
        pytest.param(lambda products: products.update({"cybrik-suite": {}}), id="x"),
    ),
)
def test_product_set_must_be_exactly_the_three_pinned_products(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], mutate: object
) -> None:
    observations = _observations()
    products = observations["products"]
    assert isinstance(products, dict)
    mutate(products)

    code, _, report_path = _assess(tmp_path, observations)

    assert code == 2
    assert capsys.readouterr().err.strip() == "observations_schema_invalid"
    assert not report_path.exists()


# ---------------------------------------------------------------------------
# Injected Docker, daemon, image and port observations
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("field", "value", "blocker"),
    (
        ("cli_present", False, "docker_cli_absent"),
        ("daemon_running", False, "docker_daemon_not_running"),
        ("images_present", [], "docker_image_missing"),
    ),
)
def test_each_docker_degradation_adds_its_exact_blocker(
    tmp_path: Path, field: str, value: object, blocker: str
) -> None:
    observations = _observations()
    docker = observations["docker"]
    assert isinstance(docker, dict)
    docker[field] = value

    code, _, report_path = _assess(tmp_path, observations)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert report["status"] == "HOLD"
    assert blocker in report["blockers"]


@pytest.mark.parametrize("bind", ("127.0.0.1:55432", "127.0.0.1:58443"))
def test_an_occupied_prospective_bind_adds_the_bind_blocker(
    tmp_path: Path, bind: str
) -> None:
    observations = _observations()
    docker = observations["docker"]
    assert isinstance(docker, dict)
    docker["binds_free"][bind] = False

    code, _, report_path = _assess(tmp_path, observations)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert "loopback_bind_occupied" in report["blockers"]
    assert report["docker"]["occupied_binds"] == [bind]


def test_unknown_image_references_do_not_satisfy_the_required_image(
    tmp_path: Path,
) -> None:
    observations = _observations()
    docker = observations["docker"]
    assert isinstance(docker, dict)
    docker["images_present"] = ["postgres:16-alpine"]

    code, _, report_path = _assess(tmp_path, observations)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert report["docker"]["missing_images"] == list(
        SCENARIO.REQUIRED_IMAGE_REFERENCES
    )


def test_blockers_are_sorted_deduplicated_and_drawn_from_the_vocabulary(
    tmp_path: Path,
) -> None:
    observations = _observations()
    products = observations["products"]
    docker = observations["docker"]
    assert isinstance(products, dict) and isinstance(docker, dict)
    for product in products.values():
        product["worktree_clean"] = False
        product["head_detached"] = False
    docker["cli_present"] = False
    docker["daemon_running"] = False
    docker["images_present"] = []
    docker["binds_free"] = {bind: False for bind in SCENARIO.PROSPECTIVE_BINDS}

    code, _, report_path = _assess(tmp_path, observations)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    blockers = report["blockers"]
    assert code == 1
    assert blockers == sorted(set(blockers))
    assert set(blockers) <= set(SCENARIO.FROZEN_BLOCKERS)
    assert set(blockers) == set(SCENARIO.FROZEN_BLOCKERS) - {
        "product_identity_mismatch"
    }


# ---------------------------------------------------------------------------
# Observations preflight is safe and fails closed
# ---------------------------------------------------------------------------


def test_oversized_observations_are_rejected_before_parsing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    payload = b'{"padding":"' + b"a" * SCENARIO.MAX_OBSERVATIONS_BYTES + b'"}'

    code, _, report_path = _assess(tmp_path, payload)

    assert code == 2
    assert capsys.readouterr().err.strip() == "observations_json_too_large"
    assert not report_path.exists()


@pytest.mark.parametrize(
    ("payload", "reason"),
    (
        (b"{", "observations_json_invalid"),
        (b"[]", "observations_json_invalid"),
        (b'{"a": 1, "a": 2}', "observations_json_invalid"),
        (b'{"observed_at": NaN}', "observations_json_invalid"),
    ),
)
def test_unsafe_observation_bytes_fail_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], payload: bytes, reason: str
) -> None:
    code, _, report_path = _assess(tmp_path, payload)

    assert code == 2
    assert capsys.readouterr().err.strip() == reason
    assert not report_path.exists()


def test_wrong_observations_schema_version_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    observations = _observations()
    observations["schema_version"] = "CYBRIK-D2-PREFOUNDER-OBSERVATIONS/v2"

    code, _, report_path = _assess(tmp_path, observations)

    assert code == 2
    assert capsys.readouterr().err.strip() == "observations_schema_version_mismatch"
    assert not report_path.exists()


@pytest.mark.parametrize(
    "mutate",
    (
        pytest.param(lambda o: o.update({"extra": 1}), id="unknown-top-key"),
        pytest.param(lambda o: o.pop("docker"), id="missing-top-key"),
        pytest.param(lambda o: o.update({"observed_at": "2026-08-03"}), id="stamp"),
        pytest.param(
            lambda o: o["docker"].update({"cli_present": 1}), id="int-for-bool"
        ),
        pytest.param(
            lambda o: o["docker"].update({"images_present": "postgres"}), id="str-list"
        ),
        pytest.param(
            lambda o: o["docker"]["binds_free"].update({"127.0.0.1:1": True}),
            id="unknown-bind",
        ),
        pytest.param(
            lambda o: o["products"]["cybrik-soc-command-center"].update(
                {"commit": "not-hex"}
            ),
            id="non-hex-commit",
        ),
        pytest.param(
            lambda o: o["products"]["cybrik-soc-command-center"].pop("tree"),
            id="missing-product-key",
        ),
        pytest.param(
            lambda o: o["tool_fabric_runtime_receipt"].update({"sha256": "0" * 64}),
            id="unknown-receipt-key",
        ),
    ),
)
def test_schema_violations_fail_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], mutate: object
) -> None:
    observations = _observations()
    mutate(observations)

    code, _, report_path = _assess(tmp_path, observations)

    assert code == 2
    assert capsys.readouterr().err.strip() == "observations_schema_invalid"
    assert not report_path.exists()


# ---------------------------------------------------------------------------
# Execute mode stays unauthored and fails closed
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "extra",
    (
        ("--mode", "execute"),
        ("--mode", "execute", "--authorization", "/tmp/anything.md"),
    ),
)
def test_execute_mode_fails_closed_and_writes_nothing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], extra: tuple[str, ...]
) -> None:
    code, _, report_path = _assess(tmp_path, _observations(), *extra)

    assert code == 2
    assert capsys.readouterr().err.strip() == "execute_mode_not_authored"
    assert not report_path.exists()


def test_execute_mode_is_rejected_before_any_input_is_read(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    suite_root, report_path = _roots(tmp_path)
    missing = tmp_path / "absent-observations.json"

    code = _run(suite_root, missing, report_path, "--mode", "execute")

    assert code == 2
    assert capsys.readouterr().err.strip() == "execute_mode_not_authored"
    assert not missing.exists()
    assert not report_path.exists()


def test_the_runner_contains_no_execution_surface() -> None:
    source = SCRIPT.read_text(encoding="utf-8")
    tree = ast.parse(source)
    called = {
        ast.unparse(node.func) for node in ast.walk(tree) if isinstance(node, ast.Call)
    }

    assert not {name for name in called if name.startswith("os.exec")}
    for forbidden in ("os.system", "os.popen", "os.fork", "os.spawn", "eval", "exec"):
        assert forbidden not in called


# ---------------------------------------------------------------------------
# Arguments, report handling and determinism
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "argv",
    (
        (),
        ("--suite-root", "/tmp"),
        ("--suite-root", "/tmp", "--observations", "/tmp/o.json"),
        ("--unknown", "1"),
    ),
)
def test_arguments_must_be_the_exact_flag_set(
    capsys: pytest.CaptureFixture[str], argv: tuple[str, ...]
) -> None:
    code = SCENARIO.main(list(argv))

    assert code == 2
    assert capsys.readouterr().err.strip() == "arguments_invalid"


def test_help_prints_usage_and_writes_nothing(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with pytest.raises(SystemExit) as raised:
        SCENARIO.main(["--help"])

    assert raised.value.code == 0
    assert "prefounder_uat_scenario.py" in capsys.readouterr().out


def test_relative_paths_fail_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    observations_path = _write_observations(tmp_path, _observations())

    code = _run(Path("suite"), observations_path, tmp_path / "report.json")

    assert code == 2
    assert capsys.readouterr().err.strip() == "suite_root_invalid"


def test_suite_root_must_be_the_checkout_containing_the_runner(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    foreign_root = tmp_path / "foreign-suite"
    foreign_root.mkdir()
    observations_path = _write_observations(tmp_path, _observations())
    report_path = tmp_path / "report.json"
    SCENARIO.BOUND_SUITE_ROOT = SUITE_ROOT

    code = _run(foreign_root, observations_path, report_path)

    assert code == 2
    assert capsys.readouterr().err.strip() == "suite_root_identity_mismatch"
    assert not report_path.exists()


def test_report_inside_the_suite_root_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    suite_root, _ = _roots(tmp_path)
    observations_path = _write_observations(tmp_path, _observations())

    code = _run(suite_root, observations_path, suite_root / "report.json")

    assert code == 2
    assert capsys.readouterr().err.strip() == "report_json_must_be_outside_suite"
    assert not (suite_root / "report.json").exists()


def test_an_existing_report_is_never_overwritten(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    suite_root, report_path = _roots(tmp_path)
    report_path.write_text("preserved", encoding="utf-8")
    observations_path = _write_observations(tmp_path, _observations())

    code = _run(suite_root, observations_path, report_path)

    assert code == 2
    assert capsys.readouterr().err.strip() == "report_json_exists"
    assert report_path.read_text(encoding="utf-8") == "preserved"


def test_the_report_is_owner_only_and_canonically_serialized(
    tmp_path: Path,
) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    raw = report_path.read_text(encoding="utf-8")
    assert code == 1
    assert stat.S_IMODE(os.stat(report_path).st_mode) == 0o600
    assert raw.endswith("\n")
    assert (
        raw == json.dumps(json.loads(raw), sort_keys=True, separators=(",", ":")) + "\n"
    )


def test_identical_inputs_produce_byte_identical_reports(tmp_path: Path) -> None:
    first = tmp_path / "first"
    second = tmp_path / "second"
    first.mkdir()
    second.mkdir()

    _assess(first, _observations())
    _assess(second, _observations())

    assert (first / "scenario-report.json").read_bytes() == (
        second / "scenario-report.json"
    ).read_bytes()
