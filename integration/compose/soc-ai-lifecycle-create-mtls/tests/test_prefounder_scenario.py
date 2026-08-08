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
MANIFEST = HARNESS_ROOT / "scripts" / "prefounder_integrated_scenario.manifest.json"
RUNNER = HARNESS_ROOT / "scripts" / "run_prefounder_integrated_uat.sh"
PACKAGE = HARNESS_ROOT / "src" / "cybrik_suite_uat_mtls"
ARCHITECTURE_DOC = (
    SUITE_ROOT
    / "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1"
    / "evidence/02-architecture-and-acceptance.md"
)
OPERATOR_GUIDE = (
    SUITE_ROOT
    / "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1"
    / "evidence/03-pre-founder-scenario-operator-guide.md"
)
OWNERSHIP_DOC = SUITE_ROOT / "CLAUDE.md"
SEAM_DECISION_DOC = (
    SUITE_ROOT / "docs/adr/DELEGATED-GOVERNOR-DECISION-UAT-MTLS-ANYCORN-R1.md"
)
ALLOWED_IMPORTS = frozenset(
    {
        "__future__",
        "hashlib",
        "json",
        "os",
        "re",
        "stat",
        "sys",
        "pathlib",
        "typing",
    }
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


def _observations_claiming_receipt() -> dict[str, object]:
    observations = _observations()
    observations["tool_fabric_runtime_receipt"] = {"claimed_present": True}
    return observations


def _shipped_manifest() -> dict[str, object]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def _seams_declared(document: dict[str, object]) -> dict[str, object]:
    """Give every product an admitted seam.

    The Tool Fabric product declares none today, so a caller-owned synthetic
    seam stands in. The runner refuses that manifest unless an adapter digest is
    also admitted, which is exactly the gate under test.
    """
    products = document["products"]
    assert isinstance(products, list)
    for product in products:
        if not product["admitted_source_roots"]:
            product["admitted_source_roots"] = [
                {
                    "identity": "synthetic-admitted-seam",
                    "path": "src/synthetic/seam.py",
                    "symbol": "SyntheticSeam",
                }
            ]
    return document


def _green_products(document: dict[str, object]) -> dict[str, object]:
    """Close out the declared per-product seam and runtime-wiring facts."""
    products = _seams_declared(document)["products"]
    assert isinstance(products, list)
    for product in products:
        for wiring in product["runtime_wiring"]:
            wiring["status"] = "wired_and_run"
    return document


def _green_manifest() -> dict[str, object]:
    """The shipped rehearsal specification with every declared state closed out."""
    document = _shipped_manifest()
    for step in document["steps"]:
        step["status"] = "implemented_and_run"
    for case in document["negative_cases"]:
        case["status"] = "executed_failed_closed"
    for check in document["terminal_evidence"]:
        check["status"] = "captured"
    return _green_products(document)


def _use_manifest(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, document: object
) -> Path:
    """Point the runner at a caller-authored manifest and re-pin its digest."""
    path = tmp_path / "manifest.json"
    payload = (
        document
        if isinstance(document, bytes)
        else (json.dumps(document, sort_keys=True, indent=2) + "\n").encode("utf-8")
    )
    path.write_bytes(payload)
    monkeypatch.setattr(SCENARIO, "INTEGRATED_SCENARIO_MANIFEST_PATH", path)
    monkeypatch.setattr(
        SCENARIO,
        "INTEGRATED_SCENARIO_MANIFEST_SHA256",
        hashlib.sha256(payload).hexdigest(),
    )
    return path


def _admit_receipt(monkeypatch: pytest.MonkeyPatch, suite_root: Path) -> None:
    receipt = suite_root / SCENARIO.TOOL_FABRIC_RECEIPT_REL
    receipt.parent.mkdir(parents=True, exist_ok=True)
    receipt_bytes = b"reviewed-receipt-bytes"
    receipt.write_bytes(receipt_bytes)
    monkeypatch.setattr(
        SCENARIO,
        "ADMITTED_TOOL_FABRIC_RECEIPT_SHA256",
        hashlib.sha256(receipt_bytes).hexdigest(),
    )


def _admit_receipt_only(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> tuple[Path, Path, Path]:
    """Admit receipt bytes without fabricating the absent Fabric producer."""
    suite_root, report_path = _roots(tmp_path)
    _admit_receipt(monkeypatch, suite_root)
    observations_path = _write_observations(tmp_path, _observations_claiming_receipt())
    return suite_root, observations_path, report_path


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
        "integrated_step_not_implemented",
        "integrated_step_not_run",
        "loopback_bind_occupied",
        "negative_case_not_run",
        "product_head_not_detached",
        "product_identity_mismatch",
        "product_source_root_absent",
        "product_worktree_not_clean",
        "runner_command_contract_not_run",
        "runtime_wiring_absent",
        "terminal_evidence_not_captured",
        "tool_fabric_negative_gap_open",
        "tool_fabric_runtime_producer_absent",
        "tool_fabric_runtime_receipt_absent",
    )
    assert SCENARIO.REHEARSAL_BLOCKERS == ("fabric_synthetic_attestation_absent",)
    assert not set(SCENARIO.REHEARSAL_BLOCKERS) & set(SCENARIO.FROZEN_BLOCKERS)
    assert SCENARIO.FROZEN_FAILURE_REASONS == (
        "arguments_invalid",
        "execute_mode_not_authored",
        "execution_plan_invalid",
        "fabric_attestation_claim_inconsistent",
        "fabric_attestation_digest_mismatch",
        "fabric_attestation_invalid",
        "fabric_attestation_must_be_outside_suite",
        "fabric_attestation_path_invalid",
        "fabric_attestation_schema_version_mismatch",
        "integrated_scenario_invalid",
        "integrated_scenario_manifest_digest_mismatch",
        "observations_json_invalid",
        "observations_json_too_large",
        "observations_receipt_claim_contradicts_tree",
        "observations_schema_invalid",
        "observations_schema_version_mismatch",
        "report_json_exists",
        "report_json_must_be_outside_suite",
        "report_json_write_failed",
        "runner_command_contract_invalid",
        "suite_root_identity_mismatch",
        "suite_root_invalid",
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
    assert report["blockers"] == [
        "integrated_step_not_implemented",
        "integrated_step_not_run",
        "negative_case_not_run",
        "product_source_root_absent",
        "runner_command_contract_not_run",
        "runtime_wiring_absent",
        "terminal_evidence_not_captured",
        "tool_fabric_negative_gap_open",
        "tool_fabric_runtime_producer_absent",
        "tool_fabric_runtime_receipt_absent",
    ]
    assert report["schema_version"] == SCENARIO.SCHEMA_VERSION
    assert report["observed_at"] == OBSERVED_AT
    assert report["mode"] == "assess"
    assert report["evidence_class"] == "rehearsal_only"
    assert report["next_blocker"] == "product_source_root_absent"
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
    suite_root, observations_path, report_path = _admit_receipt_only(
        monkeypatch, tmp_path
    )

    code = _run(suite_root, observations_path, report_path)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert report["status"] == "HOLD"
    assert "tool_fabric_runtime_producer_absent" in report["blockers"]
    assert "tool_fabric_runtime_receipt_absent" not in report["blockers"]
    assert report["tool_fabric_runtime_receipt"] == {
        "admitted_digest_pinned": True,
        "claimed_present": True,
        "present_in_tree": True,
    }


def test_an_admitted_digest_alone_never_clears_the_terminal_receipt_gate(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    suite_root, _, report_path = _admit_receipt_only(monkeypatch, tmp_path)
    (suite_root / SCENARIO.TOOL_FABRIC_RECEIPT_REL).unlink()
    observations = _observations_claiming_receipt()
    observations["tool_fabric_runtime_receipt"] = {"claimed_present": False}
    observations_path = _write_observations(tmp_path, observations)

    code = _run(suite_root, observations_path, report_path)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert report["status"] == "HOLD"
    assert "tool_fabric_runtime_producer_absent" in report["blockers"]
    assert "tool_fabric_runtime_receipt_absent" in report["blockers"]
    assert report["tool_fabric_runtime_receipt"] == {
        "admitted_digest_pinned": True,
        "claimed_present": False,
        "present_in_tree": False,
    }


def test_receipt_digest_binding_handles_short_descriptor_reads(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    suite_root, observations_path, report_path = _admit_receipt_only(
        monkeypatch, tmp_path
    )
    original_read = SCENARIO.os.read

    def short_read(descriptor: int, size: int) -> bytes:
        return original_read(descriptor, min(size, 3))

    monkeypatch.setattr(SCENARIO.os, "read", short_read)

    code = _run(suite_root, observations_path, report_path)

    assert code == 1
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["status"] == "HOLD"
    assert "tool_fabric_runtime_producer_absent" in report["blockers"]
    assert "tool_fabric_runtime_receipt_absent" not in report["blockers"]


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
    assert report["next_blocker"] == "product_head_not_detached"


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
# Execution-plan contract: exact ordered admission rehearsal, receipt before READY
# ---------------------------------------------------------------------------


def test_execution_plan_version_and_step_fields_are_exact() -> None:
    assert SCENARIO.EXECUTION_PLAN_VERSION == "CYBRIK-D2-PREFOUNDER-EXECUTION-PLAN/v1"
    assert isinstance(SCENARIO.EXECUTION_PLAN, tuple)
    assert SCENARIO.EXECUTION_PLAN
    for step in SCENARIO.EXECUTION_PLAN:
        assert tuple(sorted(step)) == ("action", "clears", "instruction", "step")
        assert isinstance(step["action"], str) and step["action"]
        assert isinstance(step["instruction"], str) and step["instruction"]
        assert isinstance(step["clears"], tuple)


def test_execution_plan_steps_are_contiguously_ordered_with_unique_actions() -> None:
    numbers = [step["step"] for step in SCENARIO.EXECUTION_PLAN]
    actions = [step["action"] for step in SCENARIO.EXECUTION_PLAN]

    assert numbers == list(range(1, len(SCENARIO.EXECUTION_PLAN) + 1))
    assert len(set(actions)) == len(actions)


def test_execution_plan_clears_partition_the_frozen_blockers() -> None:
    covered: list[str] = []
    for step in SCENARIO.EXECUTION_PLAN:
        clears = step["clears"]
        assert clears, "every rehearsal step must clear at least one blocker"
        assert list(clears) == sorted(set(clears))
        covered.extend(clears)

    assert len(covered) == len(set(covered))
    assert set(covered) == set(SCENARIO.FROZEN_BLOCKERS)


def test_execution_plan_orders_preflight_then_integration_then_the_receipt() -> None:
    actions = [step["action"] for step in SCENARIO.EXECUTION_PLAN]

    assert actions == [
        "pin_three_product_identities",
        "verify_product_source_roots",
        "verify_docker_engine",
        "verify_pinned_postgres_image",
        "verify_loopback_binds_free",
        "wire_product_owned_runtime_surfaces",
        "implement_fabric_owned_runtime_producer",
        "implement_cross_product_integrated_path",
        "author_tool_fabric_negative_coverage",
        "execute_integrated_rehearsal_steps",
        "execute_negative_case_inventory",
        "capture_rollback_and_no_residual_evidence",
        "admit_real_tool_fabric_runtime_receipt",
    ]


def test_real_tool_fabric_runtime_receipt_is_the_terminal_gate_before_ready() -> None:
    terminal = SCENARIO.EXECUTION_PLAN[-1]

    assert terminal["action"] == "admit_real_tool_fabric_runtime_receipt"
    assert terminal["clears"] == ("tool_fabric_runtime_receipt_absent",)
    assert "accepted bound receipt" in terminal["instruction"]


def test_report_embeds_plan_progress_with_the_receipt_step_pending(
    tmp_path: Path,
) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    plan = report["execution_plan"]
    blockers = set(report["blockers"])
    assert code == 1
    assert plan["plan_version"] == SCENARIO.EXECUTION_PLAN_VERSION
    assert [step["step"] for step in plan["steps"]] == [
        step["step"] for step in SCENARIO.EXECUTION_PLAN
    ]
    for reported, authored in zip(plan["steps"], SCENARIO.EXECUTION_PLAN):
        assert reported["action"] == authored["action"]
        assert reported["clears"] == list(authored["clears"])
        assert reported["instruction"] == authored["instruction"]
        assert reported["blocked_by"] == sorted(set(authored["clears"]) & blockers)
        assert reported["satisfied"] == (not reported["blocked_by"])
    unsatisfied = [step["step"] for step in plan["steps"] if not step["satisfied"]]
    assert plan["next_step"] == min(unsatisfied)
    assert plan["steps"][0]["satisfied"]
    assert plan["steps"][-1]["blocked_by"] == ["tool_fabric_runtime_receipt_absent"]


def test_a_degraded_observation_maps_to_its_exact_plan_step(tmp_path: Path) -> None:
    observations = _observations()
    docker = observations["docker"]
    assert isinstance(docker, dict)
    docker["daemon_running"] = False

    code, _, report_path = _assess(tmp_path, observations)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    plan = report["execution_plan"]
    blocked = {
        step["step"]: step["blocked_by"]
        for step in plan["steps"]
        if not step["satisfied"]
    }
    docker_step = next(
        step["step"]
        for step in plan["steps"]
        if step["action"] == "verify_docker_engine"
    )
    assert code == 1
    assert plan["next_step"] == min(blocked)
    assert blocked[docker_step] == ["docker_daemon_not_running"]
    assert blocked[len(SCENARIO.EXECUTION_PLAN)] == [
        "tool_fabric_runtime_receipt_absent"
    ]


def test_receipt_admission_alone_cannot_satisfy_the_fabric_producer_step(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    suite_root, observations_path, report_path = _admit_receipt_only(
        monkeypatch, tmp_path
    )

    code = _run(suite_root, observations_path, report_path)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    plan = report["execution_plan"]
    producer = next(
        step
        for step in plan["steps"]
        if step["action"] == "implement_fabric_owned_runtime_producer"
    )
    assert code == 1
    assert report["status"] == "HOLD"
    assert producer["satisfied"] is False
    assert producer["blocked_by"] == ["tool_fabric_runtime_producer_absent"]
    assert plan["steps"][-1]["satisfied"] is True


@pytest.mark.parametrize(
    "tamper",
    (
        pytest.param(
            lambda plan: plan[:-1],
            id="dropped-terminal-receipt-step",
        ),
        pytest.param(
            lambda plan: (
                *plan[:-1],
                {**plan[-1], "clears": ("tool_fabric_runtime_receipt_absent", "zz")},
            ),
            id="unknown-blocker-in-clears",
        ),
        pytest.param(
            lambda plan: (
                *plan[:-1],
                {
                    **plan[-1],
                    "clears": (
                        "docker_cli_absent",
                        "tool_fabric_runtime_receipt_absent",
                    ),
                },
            ),
            id="blocker-claimed-by-two-steps",
        ),
        pytest.param(
            lambda plan: (*plan[:-1], {**plan[-1], "step": 99}),
            id="non-contiguous-step-number",
        ),
        pytest.param(
            lambda plan: (*plan[:-1], {**plan[-1], "extra": True}),
            id="unknown-step-field",
        ),
        pytest.param(
            lambda plan: (plan[-1], *plan[1:]),
            id="receipt-step-reordered-first",
        ),
    ),
)
def test_a_tampered_execution_plan_fails_closed_and_writes_nothing(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    tamper: object,
) -> None:
    monkeypatch.setattr(SCENARIO, "EXECUTION_PLAN", tamper(SCENARIO.EXECUTION_PLAN))

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == "execution_plan_invalid"
    assert not report_path.exists()


# ---------------------------------------------------------------------------
# Integrated SOC -> Cyber AI -> Tool Fabric rehearsal specification
# ---------------------------------------------------------------------------


def test_integrated_scenario_vocabulary_is_exact() -> None:
    assert SCENARIO.INTEGRATED_SCENARIO_SCHEMA_VERSION == (
        "CYBRIK-D2-PREFOUNDER-INTEGRATED-SCENARIO/v2"
    )
    assert SCENARIO.EVIDENCE_CLASS == "rehearsal_only"
    assert SCENARIO.PRODUCT_FLOW == (
        "cybrik-soc-command-center",
        "cybrik-cyber-ai-platform",
        "cybrik-security-tool-fabric",
        "cybrik-suite",
    )
    assert SCENARIO.SCENARIO_SURFACES == (
        "ai_mtls",
        "postgres_replay",
        "soc_client",
        "suite_evidence",
        "tool_fabric_delegation",
        "tool_fabric_receipt",
    )
    assert SCENARIO.STEP_STATUSES == (
        "authored_not_run",
        "implemented_and_run",
        "not_implemented",
    )
    assert SCENARIO.NEGATIVE_CASE_STATUSES == (
        "authored_not_run",
        "executed_failed_closed",
        "not_implemented",
    )
    assert SCENARIO.TERMINAL_EVIDENCE_STATUSES == ("captured", "not_captured")
    assert SCENARIO.TERMINAL_EVIDENCE_CHECKS == (
        "rollback_executed",
        "no_container_residual",
        "no_listener_residual",
        "no_ephemeral_pki_residual",
        "no_repository_residual",
        "no_secret_material_residual",
    )
    assert SCENARIO.PRODUCT_ROLES == {
        "cybrik-cyber-ai-platform": "ai_runtime",
        "cybrik-security-tool-fabric": "tool_execution",
        "cybrik-soc-command-center": "soc_truth",
    }
    assert SCENARIO.RUNTIME_WIRING_STATUSES == ("not_wired", "wired_and_run")


def test_manifest_is_adjacent_digest_pinned_and_canonically_serialized() -> None:
    raw = MANIFEST.read_bytes()

    assert MANIFEST.parent == SCRIPT.parent
    assert SCENARIO.INTEGRATED_SCENARIO_MANIFEST_PATH == MANIFEST
    assert SCENARIO.INTEGRATED_SCENARIO_MANIFEST_SHA256 == (
        hashlib.sha256(raw).hexdigest()
    )
    text = raw.decode("utf-8")
    assert text == json.dumps(json.loads(text), sort_keys=True, indent=2) + "\n"


def test_manifest_declares_the_rehearsal_only_evidence_class() -> None:
    document = _shipped_manifest()

    assert document["schema_version"] == SCENARIO.INTEGRATED_SCENARIO_SCHEMA_VERSION
    assert document["evidence_class"] == "rehearsal_only"
    assert tuple(sorted(document)) == (
        "evidence_class",
        "negative_cases",
        "products",
        "schema_version",
        "steps",
        "terminal_evidence",
        "tool_fabric_runtime",
    )


def test_manifest_steps_traverse_soc_then_cyber_ai_then_tool_fabric() -> None:
    steps = _shipped_manifest()["steps"]
    order = {name: index for index, name in enumerate(SCENARIO.PRODUCT_FLOW)}
    producers = [order[step["producer"]] for step in steps]

    assert [step["step"] for step in steps] == list(range(1, len(steps) + 1))
    assert producers == sorted(producers)
    assert steps[0]["producer"] == "cybrik-soc-command-center"
    assert steps[-1]["producer"] == "cybrik-suite"
    assert {step["producer"] for step in steps} == set(SCENARIO.PRODUCT_FLOW)
    for step in steps:
        assert order[step["consumer"]] >= order[step["producer"]]
        assert step["surface"] in SCENARIO.SCENARIO_SURFACES
        assert tuple(sorted(step)) == (
            "consumer",
            "identity",
            "producer",
            "purpose",
            "status",
            "step",
            "surface",
        )


def test_every_manifest_step_carries_a_unique_exact_identity() -> None:
    steps = _shipped_manifest()["steps"]
    identities = [step["identity"] for step in steps]

    assert len(set(identities)) == len(identities)
    for identity in identities:
        assert re.fullmatch(r"[a-z][a-z0-9-]*", identity)


def test_manifest_step_statuses_are_truthfully_unrun_or_unimplemented() -> None:
    steps = _shipped_manifest()["steps"]

    assert {step["status"] for step in steps} == {
        "authored_not_run",
        "not_implemented",
    }
    fabric_steps = [
        step
        for step in steps
        if "cybrik-security-tool-fabric" in (step["producer"], step["consumer"])
    ]
    assert fabric_steps
    assert all(step["status"] == "not_implemented" for step in fabric_steps)


def test_manifest_negative_cases_map_n1_to_n10_onto_exact_steps() -> None:
    document = _shipped_manifest()
    cases = document["negative_cases"]
    step_numbers = {step["step"] for step in document["steps"]}
    declared = [case["case_id"] for case in cases]

    assert declared[:10] == [f"N{index}" for index in range(1, 11)]
    for case in cases:
        assert tuple(sorted(case)) == (
            "case_id",
            "purpose",
            "reason",
            "status",
            "step",
        )
        assert case["step"] in step_numbers
        assert case["reason"].strip() == case["reason"] and case["reason"]
    assert all(case["status"] == "authored_not_run" for case in cases[:10])


def test_manifest_negative_case_purposes_match_the_harness_case_inventory() -> None:
    required = ast.literal_eval(
        _constant_node(PACKAGE / "procedure.py", "REQUIRED_CASE_PURPOSES")
    )
    cases = {
        case["case_id"]: case["purpose"]
        for case in _shipped_manifest()["negative_cases"]
    }

    assert SCENARIO.REQUIRED_NEGATIVE_CASE_PURPOSES == required
    for case_id, purpose in required:
        assert cases[case_id] == purpose


def test_manifest_declares_the_tool_fabric_specific_negative_gap() -> None:
    cases = _shipped_manifest()["negative_cases"]
    document = _shipped_manifest()
    steps = {step["step"]: step for step in document["steps"]}
    gaps = [case for case in cases if case["case_id"].startswith("F")]

    assert gaps, "the Fabric hop must declare its missing negative coverage"
    for gap in gaps:
        assert gap["status"] == "not_implemented"
        step = steps[gap["step"]]
        assert "cybrik-security-tool-fabric" in (step["producer"], step["consumer"])


def test_manifest_terminal_evidence_covers_rollback_and_no_residual() -> None:
    checks = _shipped_manifest()["terminal_evidence"]

    assert [check["check"] for check in checks] == list(
        SCENARIO.TERMINAL_EVIDENCE_CHECKS
    )
    assert all(check["status"] == "not_captured" for check in checks)
    for check in checks:
        assert tuple(sorted(check)) == ("check", "requirement", "status")
        assert check["requirement"].strip() == check["requirement"]


def test_terminal_rollback_check_is_bound_to_the_harness_lifecycle_step() -> None:
    lifecycle = ast.literal_eval(
        _constant_node(PACKAGE / "procedure.py", "LIFECYCLE_STEPS")
    )

    assert "rollback" in lifecycle
    assert SCENARIO.TERMINAL_EVIDENCE_CHECKS[0] == "rollback_executed"


def test_manifest_scenario_surfaces_are_bound_to_the_harness_policy_surfaces() -> None:
    source = (PACKAGE / "policy.py").read_text(encoding="utf-8")
    ai_surface = ast.literal_eval(
        _constant_node(PACKAGE / "policy.py", "AI_MTLS_SURFACE")
    )
    pg_surface = ast.literal_eval(
        _constant_node(PACKAGE / "policy.py", "POSTGRES_SURFACE")
    )

    assert "PROPOSED_BINDS" in source
    assert ai_surface in SCENARIO.SCENARIO_SURFACES
    assert pg_surface in SCENARIO.SCENARIO_SURFACES


def test_report_embeds_the_derived_integrated_scenario_facts(tmp_path: Path) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    scenario = report["integrated_scenario"]
    manifest = _shipped_manifest()
    assert code == 1
    assert scenario["evidence_class"] == "rehearsal_only"
    assert scenario["manifest_version"] == SCENARIO.INTEGRATED_SCENARIO_SCHEMA_VERSION
    assert scenario["manifest_sha256"] == SCENARIO.INTEGRATED_SCENARIO_MANIFEST_SHA256
    assert scenario["product_flow"] == list(SCENARIO.PRODUCT_FLOW)
    assert [step["step"] for step in scenario["steps"]] == [
        step["step"] for step in manifest["steps"]
    ]
    assert scenario["steps_not_implemented"] == [
        step["step"]
        for step in manifest["steps"]
        if step["status"] == "not_implemented"
    ]
    assert scenario["steps_authored_not_run"] == [
        step["step"]
        for step in manifest["steps"]
        if step["status"] == "authored_not_run"
    ]
    assert scenario["negative_cases"]["authored_not_run"] == [
        f"N{index}" for index in range(1, 11)
    ]
    assert scenario["negative_cases"]["executed_failed_closed"] == []
    assert (
        scenario["tool_fabric_negative_gap"]
        == scenario["negative_cases"]["not_implemented"]
    )
    assert scenario["terminal_evidence"] == {
        "captured": [],
        "not_captured": list(SCENARIO.TERMINAL_EVIDENCE_CHECKS),
    }


def test_each_derived_step_lists_the_negative_cases_it_must_fail_closed(
    tmp_path: Path,
) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    steps = report["integrated_scenario"]["steps"]
    mapped = [case for step in steps for case in step["case_ids"]]
    manifest_cases = [case["case_id"] for case in _shipped_manifest()["negative_cases"]]
    assert code == 1
    assert sorted(mapped) == sorted(manifest_cases)
    assert len(mapped) == len(set(mapped))
    for step in steps:
        assert step["case_ids"] == sorted(step["case_ids"])


def test_all_green_observations_cannot_clear_any_integrated_blocker(
    tmp_path: Path,
) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert set(report["blockers"]) >= {
        "integrated_step_not_implemented",
        "integrated_step_not_run",
        "negative_case_not_run",
        "product_source_root_absent",
        "runtime_wiring_absent",
        "terminal_evidence_not_captured",
        "tool_fabric_negative_gap_open",
    }


@pytest.mark.parametrize(
    ("mutate", "cleared"),
    (
        pytest.param(
            lambda d: [
                step.update({"status": "implemented_and_run"})
                for step in d["steps"]
                if step["status"] == "not_implemented"
            ],
            "integrated_step_not_implemented",
            id="steps-implemented",
        ),
        pytest.param(
            lambda d: [
                step.update({"status": "implemented_and_run"})
                for step in d["steps"]
                if step["status"] == "authored_not_run"
            ],
            "integrated_step_not_run",
            id="steps-run",
        ),
        pytest.param(
            lambda d: [
                case.update({"status": "executed_failed_closed"})
                for case in d["negative_cases"]
                if case["case_id"].startswith("N")
            ],
            "negative_case_not_run",
            id="negatives-executed",
        ),
        pytest.param(
            lambda d: [
                case.update({"status": "executed_failed_closed"})
                for case in d["negative_cases"]
                if case["case_id"].startswith("F")
            ],
            "tool_fabric_negative_gap_open",
            id="fabric-gap-closed",
        ),
        pytest.param(
            lambda d: [
                check.update({"status": "captured"}) for check in d["terminal_evidence"]
            ],
            "terminal_evidence_not_captured",
            id="terminal-evidence-captured",
        ),
        pytest.param(
            lambda d: [
                wiring.update({"status": "wired_and_run"})
                for product in d["products"]
                for wiring in product["runtime_wiring"]
            ],
            "runtime_wiring_absent",
            id="runtime-wiring-closed",
        ),
    ),
)
def test_each_integrated_blocker_is_cleared_only_by_its_own_declared_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    mutate: object,
    cleared: str,
) -> None:
    document = _shipped_manifest()
    mutate(document)
    _use_manifest(monkeypatch, tmp_path, document)

    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert cleared not in report["blockers"]
    assert set(report["blockers"]) == {
        "integrated_step_not_implemented",
        "integrated_step_not_run",
        "negative_case_not_run",
        "product_source_root_absent",
        "runner_command_contract_not_run",
        "runtime_wiring_absent",
        "terminal_evidence_not_captured",
        "tool_fabric_negative_gap_open",
        "tool_fabric_runtime_producer_absent",
        "tool_fabric_runtime_receipt_absent",
    } - {cleared}


def test_next_blocker_walks_the_plan_in_exact_order(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    suite_root, report_path = _roots(tmp_path)
    _admit_receipt(monkeypatch, suite_root)
    _use_manifest(monkeypatch, tmp_path, _green_manifest())
    monkeypatch.setattr(SCENARIO, "RUNNER_EXECUTION_STATUS", "executed")
    observations_path = _write_observations(tmp_path, _observations_claiming_receipt())

    code = _run(suite_root, observations_path, report_path)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert report["next_blocker"] == "tool_fabric_runtime_producer_absent"
    assert report["blockers"] == ["tool_fabric_runtime_producer_absent"]
    assert "integrated_step_not_implemented" not in report["blockers"]
    assert "integrated_step_not_run" not in report["blockers"]
    assert "product_source_root_absent" not in report["blockers"]


def test_a_tampered_manifest_fails_closed_on_the_pinned_digest(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    path = _use_manifest(monkeypatch, tmp_path, _shipped_manifest())
    path.write_bytes(path.read_bytes() + b" ")

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == (
        "integrated_scenario_manifest_digest_mismatch"
    )
    assert not report_path.exists()


def test_a_missing_manifest_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    path = _use_manifest(monkeypatch, tmp_path, _shipped_manifest())
    path.unlink()

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == (
        "integrated_scenario_manifest_digest_mismatch"
    )
    assert not report_path.exists()


def test_a_symlinked_manifest_is_never_followed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    path = _use_manifest(monkeypatch, tmp_path, _shipped_manifest())
    target = tmp_path / "target-manifest.json"
    path.rename(target)
    path.symlink_to(target)

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == (
        "integrated_scenario_manifest_digest_mismatch"
    )
    assert not report_path.exists()


@pytest.mark.parametrize(
    "mutate",
    (
        pytest.param(
            lambda d: d.update({"evidence_class": "runtime_evidence"}),
            id="evidence-class-overclaims",
        ),
        pytest.param(
            lambda d: d.update({"schema_version": "OTHER/v1"}), id="schema-version"
        ),
        pytest.param(lambda d: d.update({"extra": 1}), id="unknown-top-key"),
        pytest.param(lambda d: d.pop("terminal_evidence"), id="missing-top-key"),
        pytest.param(lambda d: d["steps"].pop(0), id="step-numbering-broken"),
        pytest.param(
            lambda d: d["steps"][0].update({"producer": "cybrik-suite"}),
            id="flow-runs-backwards",
        ),
        pytest.param(
            lambda d: d["steps"][-1].update({"consumer": "cybrik-soc-command-center"}),
            id="consumer-runs-backwards",
        ),
        pytest.param(
            lambda d: d["steps"][0].update({"producer": "cybrik-unknown-repo"}),
            id="unknown-producer",
        ),
        pytest.param(
            lambda d: d["steps"][0].update({"surface": "http"}), id="unknown-surface"
        ),
        pytest.param(
            lambda d: d["steps"][0].update({"status": "passed"}), id="unknown-status"
        ),
        pytest.param(
            lambda d: d["steps"][1].update({"identity": d["steps"][0]["identity"]}),
            id="duplicate-identity",
        ),
        pytest.param(
            lambda d: d["steps"][0].update({"identity": "Not A Slug"}),
            id="malformed-identity",
        ),
        pytest.param(lambda d: d["negative_cases"].pop(0), id="dropped-negative-case"),
        pytest.param(
            lambda d: d["negative_cases"][0].update({"purpose": "something_else"}),
            id="negative-case-purpose-drift",
        ),
        pytest.param(
            lambda d: d["negative_cases"][0].update({"status": "not_implemented"}),
            id="authored-negative-case-claimed-unimplemented",
        ),
        pytest.param(
            lambda d: d["negative_cases"][0].update({"step": 99}),
            id="negative-case-off-step",
        ),
        pytest.param(
            lambda d: d["negative_cases"].append(dict(d["negative_cases"][0])),
            id="duplicate-negative-case",
        ),
        pytest.param(
            lambda d: d["terminal_evidence"].pop(), id="missing-terminal-check"
        ),
        pytest.param(
            lambda d: d["terminal_evidence"].reverse(), id="terminal-checks-reordered"
        ),
        pytest.param(
            lambda d: d["terminal_evidence"][0].update({"status": "assumed"}),
            id="unknown-terminal-status",
        ),
    ),
)
def test_an_invalid_manifest_fails_closed_and_writes_nothing(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    mutate: object,
) -> None:
    document = _shipped_manifest()
    mutate(document)
    _use_manifest(monkeypatch, tmp_path, document)

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == "integrated_scenario_invalid"
    assert not report_path.exists()


def test_a_fabric_negative_case_pinned_to_a_non_fabric_step_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    document = _shipped_manifest()
    for case in document["negative_cases"]:
        if case["case_id"].startswith("F"):
            case["step"] = 1
            break
    _use_manifest(monkeypatch, tmp_path, document)

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == "integrated_scenario_invalid"
    assert not report_path.exists()


def test_an_oversized_manifest_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    _use_manifest(
        monkeypatch, tmp_path, b"{" + b" " * SCENARIO.MAX_MANIFEST_BYTES + b"}"
    )

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == (
        "integrated_scenario_manifest_digest_mismatch"
    )
    assert not report_path.exists()


def test_unparsable_manifest_bytes_fail_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    _use_manifest(monkeypatch, tmp_path, b"[]")

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == "integrated_scenario_invalid"
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


# ---------------------------------------------------------------------------
# Synthetic Tool Fabric attestation: a separate rehearsal dimension only
# ---------------------------------------------------------------------------


def _claims() -> dict[str, bool]:
    """The exact claim pins a synthetic rehearsal artifact must carry."""
    return {
        "execution_authority": False,
        "is_runtime_receipt": False,
        "read_only": True,
        "runtime_executed": False,
        "side_effect_performed": False,
        "synthetic": True,
    }


def _claims_digest(claims: object) -> str:
    return hashlib.sha256(
        json.dumps(claims, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _attestation() -> dict[str, object]:
    claims = _claims()
    return {
        "artifact_class": SCENARIO.FABRIC_ATTESTATION_ARTIFACT_CLASS,
        "claims": claims,
        "claims_digest": _claims_digest(claims),
        "environment": SCENARIO.FABRIC_ATTESTATION_ENVIRONMENT,
        "evidence_class": SCENARIO.EVIDENCE_CLASS,
        "producer": SCENARIO.FABRIC_ATTESTATION_PRODUCER,
        "schema_tag": SCENARIO.FABRIC_ATTESTATION_SCHEMA_TAG,
        "schema_version": SCENARIO.FABRIC_ATTESTATION_SCHEMA_VERSION,
    }


def _attestation_bytes(document: object) -> bytes:
    if isinstance(document, bytes):
        return document
    payload = json.dumps(document, sort_keys=True, separators=(",", ":")) + "\n"
    return payload.encode("utf-8")


def _write_attestation(
    directory: Path, document: object, *, name: str = "fabric-attestation.json"
) -> tuple[Path, str]:
    path = directory / name
    payload = _attestation_bytes(document)
    path.write_bytes(payload)
    return path, hashlib.sha256(payload).hexdigest()


def _flags(path: object, digest: str) -> tuple[str, ...]:
    return (
        "--fabric-attestation",
        str(path),
        "--fabric-attestation-sha256",
        digest,
    )


def _assess_with_attestation(
    tmp_path: Path, document: object, **kwargs: object
) -> tuple[int, Path, Path]:
    """Assess green observations against a caller-authored attestation."""
    path, digest = _write_attestation(tmp_path, document)
    return _assess(
        tmp_path, _observations(), *_flags(path, str(kwargs.get("digest", digest)))
    )


def test_usage_documents_the_optional_synthetic_attestation_flags() -> None:
    assert "--fabric-attestation ABSOLUTE" in SCENARIO.USAGE
    assert "--fabric-attestation-sha256 HEX64" in SCENARIO.USAGE
    assert SCENARIO.OPTIONAL_FLAGS == (
        "--fabric-attestation",
        "--fabric-attestation-sha256",
        "--mode",
    )


def test_rehearsal_dimension_is_versioned_and_disjoint_from_the_frozen_gate() -> None:
    assert SCENARIO.PREFOUNDER_REHEARSAL_VERSION == "CYBRIK-D2-PREFOUNDER-REHEARSAL/v1"
    assert SCENARIO.FABRIC_ATTESTATION_SCHEMA_VERSION == (
        "CYBRIK-D2-PREFOUNDER-FABRIC-ATTESTATION/v1"
    )
    assert SCENARIO.FABRIC_ATTESTATION_TRUE_CLAIMS == ("read_only", "synthetic")
    assert SCENARIO.FABRIC_ATTESTATION_FALSE_CLAIMS == (
        "execution_authority",
        "is_runtime_receipt",
        "runtime_executed",
        "side_effect_performed",
    )
    assert set(SCENARIO.REHEARSAL_BLOCKERS).isdisjoint(SCENARIO.FROZEN_BLOCKERS)


def test_the_pinned_fabric_schema_tag_is_self_describing_and_synthetic() -> None:
    assert SCENARIO.FABRIC_ATTESTATION_SCHEMA_TAG == (
        "cybrik-fabric.local-uat-only.readonly-attestation@0.0.0-synthetic"
    )
    assert SCENARIO.FABRIC_ATTESTATION_PRODUCER == "cybrik-security-tool-fabric"
    assert SCENARIO.FABRIC_ATTESTATION_ENVIRONMENT == "UAT"


def test_an_absent_attestation_is_a_rehearsal_blocker_only(tmp_path: Path) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    rehearsal = report["prefounder_rehearsal"]
    assert code == 1
    assert rehearsal["blockers"] == ["fabric_synthetic_attestation_absent"]
    assert rehearsal["fabric_attestation"]["attestation_admitted"] is False
    assert rehearsal["fabric_attestation"]["artifact_sha256"] is None
    assert rehearsal["fabric_attestation"]["claims"] is None
    assert "fabric_synthetic_attestation_absent" not in report["blockers"]
    assert report["next_blocker"] != "fabric_synthetic_attestation_absent"
    for step in report["execution_plan"]["steps"]:
        assert "fabric_synthetic_attestation_absent" not in step["clears"]
        assert "fabric_synthetic_attestation_absent" not in step["blocked_by"]


def test_a_valid_attestation_clears_only_the_rehearsal_blocker(
    tmp_path: Path,
) -> None:
    code, _, report_path = _assess_with_attestation(tmp_path, _attestation())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    rehearsal = report["prefounder_rehearsal"]
    assert code == 1
    assert report["status"] == "HOLD"
    assert rehearsal["blockers"] == []
    assert rehearsal["fabric_attestation"]["attestation_admitted"] is True
    assert rehearsal["fabric_attestation"]["claims"] == _claims()
    assert "tool_fabric_runtime_receipt_absent" in report["blockers"]


def test_the_rehearsal_dimension_pins_no_runtime_execution(tmp_path: Path) -> None:
    _, _, report_path = _assess_with_attestation(tmp_path, _attestation())

    rehearsal = json.loads(report_path.read_text(encoding="utf-8"))[
        "prefounder_rehearsal"
    ]
    assert rehearsal["dimension_version"] == SCENARIO.PREFOUNDER_REHEARSAL_VERSION
    assert rehearsal["grants_runtime_evidence"] is False
    assert rehearsal["is_runtime_receipt"] is False
    assert rehearsal["runtime_executed"] is False


def test_synthetic_evidence_leaves_the_frozen_assessment_byte_identical(
    tmp_path: Path,
) -> None:
    without = tmp_path / "without"
    with_attestation = tmp_path / "with"
    without.mkdir()
    with_attestation.mkdir()

    bare_code, _, bare_report = _assess(without, _observations())
    signed_code, _, signed_report = _assess_with_attestation(
        with_attestation, _attestation()
    )

    bare = json.loads(bare_report.read_text(encoding="utf-8"))
    signed = json.loads(signed_report.read_text(encoding="utf-8"))
    assert bare_code == signed_code == 1
    assert bare.pop("prefounder_rehearsal") != signed.pop("prefounder_rehearsal")
    assert bare == signed
    assert signed["status"] == "HOLD"
    assert signed["execution"] == {"authorized": False, "runtime_executed": False}
    assert signed["tool_fabric_runtime_receipt"]["admitted_digest_pinned"] is False


def test_synthetic_evidence_never_makes_ready_or_the_receipt_step_reachable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    suite_root, _, report_path = _admit_receipt_only(monkeypatch, tmp_path)
    (suite_root / SCENARIO.TOOL_FABRIC_RECEIPT_REL).unlink()
    monkeypatch.setattr(SCENARIO, "ADMITTED_TOOL_FABRIC_RECEIPT_SHA256", None)
    observations = _observations_claiming_receipt()
    observations["tool_fabric_runtime_receipt"] = {"claimed_present": False}
    observations_path = _write_observations(tmp_path, observations)
    path, digest = _write_attestation(tmp_path, _attestation())

    code = _run(suite_root, observations_path, report_path, *_flags(path, digest))

    report = json.loads(report_path.read_text(encoding="utf-8"))
    terminal = report["execution_plan"]["steps"][-1]
    assert code == 1
    assert report["status"] == "HOLD"
    assert "tool_fabric_runtime_producer_absent" in report["blockers"]
    assert "tool_fabric_runtime_receipt_absent" in report["blockers"]
    assert terminal["action"] == "admit_real_tool_fabric_runtime_receipt"
    assert terminal["blocked_by"] == ["tool_fabric_runtime_receipt_absent"]
    assert terminal["satisfied"] is False
    assert report["prefounder_rehearsal"]["blockers"] == []


def test_identical_attestation_inputs_produce_byte_identical_reports(
    tmp_path: Path,
) -> None:
    first = tmp_path / "first"
    second = tmp_path / "second"
    first.mkdir()
    second.mkdir()

    _assess_with_attestation(first, _attestation())
    _assess_with_attestation(second, _attestation())

    assert (first / "scenario-report.json").read_bytes() == (
        second / "scenario-report.json"
    ).read_bytes()


@pytest.mark.parametrize(
    "argv",
    (
        ("--fabric-attestation", "/tmp/attestation.json"),
        ("--fabric-attestation-sha256", "0" * 64),
    ),
)
def test_the_attestation_flags_must_be_supplied_together(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], argv: tuple[str, ...]
) -> None:
    code, _, report_path = _assess(tmp_path, _observations(), *argv)

    assert code == 2
    assert capsys.readouterr().err.strip() == "arguments_invalid"
    assert not report_path.exists()


@pytest.mark.parametrize(
    "digest",
    ("", "0" * 63, "0" * 65, "0" * 40, "F" * 64, "g" * 64, " " + "0" * 63),
)
def test_a_malformed_attestation_digest_argument_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], digest: str
) -> None:
    path, _ = _write_attestation(tmp_path, _attestation())

    code, _, report_path = _assess(tmp_path, _observations(), *_flags(path, digest))

    assert code == 2
    assert capsys.readouterr().err.strip() == "arguments_invalid"
    assert not report_path.exists()


def test_an_attestation_digest_mismatch_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code, _, report_path = _assess_with_attestation(
        tmp_path, _attestation(), digest="0" * 64
    )

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_digest_mismatch"
    assert not report_path.exists()


def test_an_attestation_replaced_after_digest_pinning_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path, digest = _write_attestation(tmp_path, _attestation())
    swapped = _attestation()
    swapped["claims"] = {**_claims(), "is_runtime_receipt": True}
    swapped["claims_digest"] = _claims_digest(swapped["claims"])
    path.write_bytes(_attestation_bytes(swapped))

    code, _, report_path = _assess(tmp_path, _observations(), *_flags(path, digest))

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_digest_mismatch"
    assert not report_path.exists()


def test_an_attestation_mutated_during_the_read_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    path, digest = _write_attestation(tmp_path, _attestation())
    attested_inode = path.stat().st_ino
    original_read = SCENARIO.os.read
    raced = [False]

    def racing_read(descriptor: int, size: int) -> bytes:
        """Extend the artifact in place while its own descriptor is mid-read."""
        chunk = original_read(descriptor, size)
        if not raced[0] and os.fstat(descriptor).st_ino == attested_inode:
            raced[0] = True
            with open(path, "ab") as handle:
                handle.write(b" ")
        return chunk

    monkeypatch.setattr(SCENARIO.os, "read", racing_read)

    code, _, report_path = _assess(tmp_path, _observations(), *_flags(path, digest))

    assert raced[0]
    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not report_path.exists()


def test_a_symlinked_attestation_is_never_followed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    target, digest = _write_attestation(tmp_path, _attestation(), name="target.json")
    link = tmp_path / "linked-attestation.json"
    link.symlink_to(target)

    code, _, report_path = _assess(tmp_path, _observations(), *_flags(link, digest))

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not report_path.exists()


def test_a_hard_linked_attestation_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path, digest = _write_attestation(tmp_path, _attestation())
    os.link(path, tmp_path / "second-name.json")

    code, _, report_path = _assess(tmp_path, _observations(), *_flags(path, digest))

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not report_path.exists()


def test_a_non_regular_attestation_target_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    directory = tmp_path / "attestation-directory"
    directory.mkdir()

    code, _, report_path = _assess(
        tmp_path, _observations(), *_flags(directory, "0" * 64)
    )

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not report_path.exists()


def test_a_missing_or_empty_attestation_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    empty = tmp_path / "empty-attestation.json"
    empty.write_bytes(b"")

    missing_code, _, missing_report = _assess(
        tmp_path, _observations(), *_flags(tmp_path / "absent.json", "0" * 64)
    )
    assert missing_code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not missing_report.exists()

    second = tmp_path / "second"
    second.mkdir()
    empty_code, _, empty_report = _assess(
        second, _observations(), *_flags(empty, "0" * 64)
    )

    assert empty_code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not empty_report.exists()


@pytest.mark.parametrize(
    "raw",
    (
        "relative/attestation.json",
        "/absolute/../escaped/attestation.json",
        "/absolute/./attestation.json",
        "",
    ),
)
def test_a_relative_or_escaping_attestation_path_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], raw: str
) -> None:
    code, _, report_path = _assess(tmp_path, _observations(), *_flags(raw, "0" * 64))

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_path_invalid"
    assert not report_path.exists()


def test_an_escaping_attestation_path_is_rejected_before_it_is_opened(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path, digest = _write_attestation(tmp_path, _attestation())
    escaping = tmp_path / "hop" / ".." / path.name
    (tmp_path / "hop").mkdir()

    code, _, report_path = _assess(tmp_path, _observations(), *_flags(escaping, digest))

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_path_invalid"
    assert not report_path.exists()


def test_an_attestation_inside_the_suite_checkout_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """External Fabric-lane evidence is never read from the Suite checkout."""
    suite_root, report_path = _roots(tmp_path)
    inside = suite_root / "evidence"
    inside.mkdir()
    path, digest = _write_attestation(inside, _attestation())
    observations_path = _write_observations(tmp_path, _observations())

    code = _run(suite_root, observations_path, report_path, *_flags(path, digest))

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_must_be_outside_suite"
    assert not report_path.exists()


def test_an_attestation_linked_into_the_suite_checkout_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A lexically external path whose parent resolves inside is still refused."""
    suite_root, report_path = _roots(tmp_path)
    inside = suite_root / "evidence"
    inside.mkdir()
    path, digest = _write_attestation(inside, _attestation())
    hop = tmp_path / "hop"
    hop.symlink_to(inside, target_is_directory=True)
    observations_path = _write_observations(tmp_path, _observations())

    code = _run(
        suite_root, observations_path, report_path, *_flags(hop / path.name, digest)
    )

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_must_be_outside_suite"
    assert not report_path.exists()


def test_an_oversized_attestation_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    oversized = b"{" + b" " * SCENARIO.MAX_FABRIC_ATTESTATION_BYTES + b"}"

    code, _, report_path = _assess_with_attestation(tmp_path, oversized)

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not report_path.exists()


@pytest.mark.parametrize(
    "payload",
    (
        b"{",
        b"not json at all",
        b"[]",
        b'"a string"',
        b'{"claims": 1, "claims": 2}',
        b'{"claims": NaN}',
        b"\xff\xfe\x00",
    ),
)
def test_malformed_attestation_bytes_fail_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], payload: bytes
) -> None:
    code, _, report_path = _assess_with_attestation(tmp_path, payload)

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not report_path.exists()


def test_attestation_schema_version_drift_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    document = _attestation()
    document["schema_version"] = "CYBRIK-D2-PREFOUNDER-FABRIC-ATTESTATION/v2"

    code, _, report_path = _assess_with_attestation(tmp_path, document)

    assert code == 2
    assert capsys.readouterr().err.strip() == (
        "fabric_attestation_schema_version_mismatch"
    )
    assert not report_path.exists()


@pytest.mark.parametrize(
    "mutate",
    (
        pytest.param(
            lambda d: d.update({"artifact_class": "runtime_receipt"}),
            id="artifact-class",
        ),
        pytest.param(lambda d: d.update({"producer": "cybrik-suite"}), id="producer"),
        pytest.param(
            lambda d: d.update({"environment": "production"}), id="environment"
        ),
        pytest.param(
            lambda d: d.update({"schema_tag": "cybrik-fabric.receipt@1.0.0"}),
            id="schema-tag",
        ),
        pytest.param(
            lambda d: d.update({"evidence_class": "runtime_evidence"}),
            id="evidence-class",
        ),
        pytest.param(lambda d: d.update({"extra": True}), id="extra-field"),
        pytest.param(lambda d: d.pop("producer"), id="missing-field"),
        pytest.param(lambda d: d.update({"claims": []}), id="claims-not-mapping"),
        pytest.param(
            lambda d: d.update({"claims_digest": "not-a-digest"}),
            id="claims-digest-shape",
        ),
    ),
)
def test_attestation_envelope_drift_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], mutate: object
) -> None:
    document = _attestation()
    mutate(document)

    code, _, report_path = _assess_with_attestation(tmp_path, document)

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not report_path.exists()


@pytest.mark.parametrize(
    "mutate",
    (
        pytest.param(lambda c: c.pop("synthetic"), id="missing-claim"),
        pytest.param(lambda c: c.update({"attested": True}), id="extra-claim"),
    ),
)
def test_the_attestation_claim_set_must_be_exact(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], mutate: object
) -> None:
    document = _attestation()
    mutate(document["claims"])
    document["claims_digest"] = _claims_digest(document["claims"])

    code, _, report_path = _assess_with_attestation(tmp_path, document)

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_invalid"
    assert not report_path.exists()


@pytest.mark.parametrize(
    "name",
    (
        "execution_authority",
        "is_runtime_receipt",
        "read_only",
        "runtime_executed",
        "side_effect_performed",
        "synthetic",
    ),
)
def test_every_required_attestation_claim_must_hold_its_exact_pin(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], name: str
) -> None:
    document = _attestation()
    claims = document["claims"]
    claims[name] = not claims[name]
    document["claims_digest"] = _claims_digest(claims)

    code, _, report_path = _assess_with_attestation(tmp_path, document)

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_claim_inconsistent"
    assert not report_path.exists()


@pytest.mark.parametrize(
    ("name", "stand_in"),
    (
        ("synthetic", 1),
        ("read_only", "true"),
        ("execution_authority", 0),
        ("is_runtime_receipt", None),
        ("runtime_executed", ""),
        ("side_effect_performed", []),
    ),
)
def test_a_truthy_stand_in_is_never_an_attestation_claim(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    name: str,
    stand_in: object,
) -> None:
    document = _attestation()
    claims = document["claims"]
    claims[name] = stand_in
    document["claims_digest"] = _claims_digest(claims)

    code, _, report_path = _assess_with_attestation(tmp_path, document)

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_claim_inconsistent"
    assert not report_path.exists()


def test_a_claims_digest_that_does_not_bind_the_claims_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    document = _attestation()
    document["claims_digest"] = _claims_digest({**_claims(), "synthetic": False})

    code, _, report_path = _assess_with_attestation(tmp_path, document)

    assert code == 2
    assert capsys.readouterr().err.strip() == "fabric_attestation_claim_inconsistent"
    assert not report_path.exists()


def test_the_bounded_reader_refuses_a_symlink_and_a_hard_link(
    tmp_path: Path,
) -> None:
    regular = tmp_path / "regular.json"
    regular.write_bytes(b"{}")
    link = tmp_path / "link.json"
    link.symlink_to(regular)
    hard = tmp_path / "hard.json"
    hard.write_bytes(b"{}")
    os.link(hard, tmp_path / "hard-alias.json")

    assert (
        SCENARIO._read_exact_bytes(
            regular, limit=1024, reason="fabric_attestation_invalid"
        )
        == b"{}"
    )
    for unsafe in (link, hard, tmp_path):
        with pytest.raises(SCENARIO.ScenarioFailure) as raised:
            SCENARIO._read_exact_bytes(
                unsafe, limit=1024, reason="fabric_attestation_invalid"
            )
        assert str(raised.value) == "fabric_attestation_invalid"


def test_the_bounded_reader_tolerates_short_descriptor_reads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path, _ = _write_attestation(tmp_path, _attestation())
    original_read = SCENARIO.os.read
    monkeypatch.setattr(
        SCENARIO.os,
        "read",
        lambda descriptor, size: original_read(descriptor, min(size, 3)),
    )

    payload = SCENARIO._read_exact_bytes(
        path,
        limit=SCENARIO.MAX_FABRIC_ATTESTATION_BYTES,
        reason="fabric_attestation_invalid",
    )

    assert payload == path.read_bytes()


def test_the_bounded_reader_only_emits_frozen_failure_reasons() -> None:
    with pytest.raises(SCENARIO.ScenarioFailure) as raised:
        SCENARIO._read_exact_bytes(
            Path("/nonexistent/attestation.json"), limit=16, reason="not_a_reason"
        )

    assert str(raised.value) == "vocabulary_violation"


def test_the_rehearsal_blocker_vocabulary_is_enforced() -> None:
    assert (
        SCENARIO._rehearsal_blocker("fabric_synthetic_attestation_absent")
        == "fabric_synthetic_attestation_absent"
    )
    with pytest.raises(SCENARIO.ScenarioFailure) as raised:
        SCENARIO._rehearsal_blocker("tool_fabric_runtime_receipt_absent")

    assert str(raised.value) == "vocabulary_violation"


# ---------------------------------------------------------------------------
# Three-product roles, surfaces, admitted source roots and runtime wiring
# ---------------------------------------------------------------------------


def test_product_roles_are_bound_to_the_governing_ownership_table() -> None:
    ownership = OWNERSHIP_DOC.read_text(encoding="utf-8")
    concerns = {
        repository: concern
        for concern, repository in re.findall(
            r"^\|\s*(.+?)\s*\|\s*`(cybrik-[a-z-]+)`\s*\|$", ownership, re.MULTILINE
        )
    }

    assert set(SCENARIO.PRODUCT_ROLES) == set(SCENARIO.PINNED_PRODUCTS)
    assert set(SCENARIO.PRODUCT_ROLES) <= set(concerns)
    assert "SOC truth" in concerns["cybrik-soc-command-center"]
    assert "Tool execution authority" in concerns["cybrik-security-tool-fabric"]
    assert "Model runtime" in concerns["cybrik-cyber-ai-platform"]


def test_manifest_declares_every_pinned_product_in_exact_flow_order() -> None:
    products = _shipped_manifest()["products"]
    expected = [
        name for name in SCENARIO.PRODUCT_FLOW if name in SCENARIO.PRODUCT_ROLES
    ]

    assert [product["repository"] for product in products] == expected
    for product in products:
        assert tuple(sorted(product)) == (
            "admitted_source_roots",
            "repository",
            "role",
            "runtime_wiring",
            "surfaces",
        )
        assert product["role"] == SCENARIO.PRODUCT_ROLES[product["repository"]]


def test_manifest_product_surfaces_match_the_steps_that_product_produces() -> None:
    document = _shipped_manifest()

    for product in document["products"]:
        produced = sorted(
            {
                step["surface"]
                for step in document["steps"]
                if step["producer"] == product["repository"]
            }
        )
        assert product["surfaces"] == produced
        assert set(product["surfaces"]) <= set(SCENARIO.SCENARIO_SURFACES)


def test_admitted_source_roots_are_pinned_by_the_committed_decision_record() -> None:
    seams = SEAM_DECISION_DOC.read_text(encoding="utf-8")
    declared = {
        product["repository"]: product["admitted_source_roots"]
        for product in _shipped_manifest()["products"]
    }

    assert declared["cybrik-soc-command-center"]
    assert declared["cybrik-cyber-ai-platform"]
    for repository, roots in declared.items():
        commit = SCENARIO.PINNED_PRODUCTS[repository][0]
        for root in roots:
            assert tuple(sorted(root)) == ("identity", "path", "symbol")
            assert re.fullmatch(r"[a-z][a-z0-9-]*", root["identity"])
            assert f"{repository}@{commit}:{root['path']}::{root['symbol']}" in seams


def test_tool_fabric_declares_no_admitted_source_root_today() -> None:
    fabric = next(
        product
        for product in _shipped_manifest()["products"]
        if product["repository"] == "cybrik-security-tool-fabric"
    )

    assert fabric["admitted_source_roots"] == []


def test_manifest_runtime_wiring_is_truthfully_not_wired() -> None:
    identities: list[str] = []

    for product in _shipped_manifest()["products"]:
        assert product["runtime_wiring"]
        for wiring in product["runtime_wiring"]:
            assert tuple(sorted(wiring)) == ("identity", "requirement", "status")
            assert wiring["status"] == "not_wired"
            assert wiring["requirement"].strip() == wiring["requirement"]
            identities.append(wiring["identity"])

    assert len(set(identities)) == len(identities)


def test_absent_source_roots_and_wiring_derive_their_exact_blockers(
    tmp_path: Path,
) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    products = report["integrated_scenario"]["products"]
    fabric = next(
        product
        for product in products
        if product["repository"] == "cybrik-security-tool-fabric"
    )
    assert code == 1
    assert "product_source_root_absent" in report["blockers"]
    assert "runtime_wiring_absent" in report["blockers"]
    assert [product["repository"] for product in products] == [
        name for name in SCENARIO.PRODUCT_FLOW if name in SCENARIO.PRODUCT_ROLES
    ]
    assert fabric["admitted_source_roots"] == []
    assert fabric["role"] == "tool_execution"
    assert fabric["wiring_not_wired"]


def test_a_source_root_cleared_without_the_wiring_leaves_the_wiring_blocker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    suite_root, report_path = _roots(tmp_path)
    _use_manifest(monkeypatch, tmp_path, _seams_declared(_shipped_manifest()))
    observations_path = _write_observations(tmp_path, _observations())

    code = _run(suite_root, observations_path, report_path)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert "product_source_root_absent" not in report["blockers"]
    assert "runtime_wiring_absent" in report["blockers"]


@pytest.mark.parametrize(
    "mutate",
    (
        pytest.param(
            lambda d: d["products"][0].update({"role": "tool_execution"}),
            id="role-not-owned",
        ),
        pytest.param(
            lambda d: d["products"][0].update({"surfaces": ["suite_evidence"]}),
            id="surface-not-produced",
        ),
        pytest.param(
            lambda d: d["products"][0].update({"surfaces": ["not_a_surface"]}),
            id="unknown-surface",
        ),
        pytest.param(lambda d: d["products"].reverse(), id="products-out-of-order"),
        pytest.param(lambda d: d["products"].pop(), id="missing-product"),
        pytest.param(
            lambda d: d["products"][0].update({"extra": 1}), id="unknown-product-key"
        ),
        pytest.param(
            lambda d: d["products"][0]["runtime_wiring"][0].update(
                {"status": "passed"}
            ),
            id="unknown-wiring-status",
        ),
        pytest.param(
            lambda d: d["products"][0].update({"runtime_wiring": []}), id="empty-wiring"
        ),
        pytest.param(
            lambda d: d["products"][0]["admitted_source_roots"][0].update(
                {"path": "/etc/passwd"}
            ),
            id="absolute-source-root",
        ),
        pytest.param(
            lambda d: d["products"][0]["admitted_source_roots"][0].update(
                {"path": "../escape.py"}
            ),
            id="traversing-source-root",
        ),
        pytest.param(
            lambda d: d["products"][1]["runtime_wiring"].append(
                dict(d["products"][1]["runtime_wiring"][0])
            ),
            id="duplicate-wiring-identity",
        ),
    ),
)
def test_manifest_product_violations_fail_closed(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    mutate: object,
) -> None:
    document = _shipped_manifest()
    mutate(document)
    _use_manifest(monkeypatch, tmp_path, document)

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == "integrated_scenario_invalid"
    assert not report_path.exists()


# ---------------------------------------------------------------------------
# Frozen runner command contract: authored, ordered, never executed
# ---------------------------------------------------------------------------


def test_runner_command_contract_shape_is_exact() -> None:
    orders = [command["order"] for command in SCENARIO.RUNNER_COMMAND_CONTRACT]
    identities = [command["identity"] for command in SCENARIO.RUNNER_COMMAND_CONTRACT]

    assert SCENARIO.RUNNER_CONTRACT_VERSION == "CYBRIK-D2-PREFOUNDER-RUNNER-CONTRACT/v1"
    assert SCENARIO.RUNNER_PHASES == ("preflight", "scenario", "terminal")
    assert SCENARIO.RUNNER_EXECUTION_STATUSES == ("authored_not_run", "executed")
    assert SCENARIO.RUNNER_EXECUTION_STATUS == "authored_not_run"
    assert orders == list(range(1, len(orders) + 1))
    assert len(set(identities)) == len(identities)
    for command in SCENARIO.RUNNER_COMMAND_CONTRACT:
        assert tuple(sorted(command)) == ("identity", "order", "phase", "requirement")
        assert command["phase"] in SCENARIO.RUNNER_PHASES
        assert re.fullmatch(r"[a-z][a-z0-9-]*", command["identity"])
        assert command["requirement"].strip() == command["requirement"]


def test_runner_contract_orders_preflight_then_scenario_then_terminal() -> None:
    ordinals = [
        SCENARIO.RUNNER_PHASES.index(command["phase"])
        for command in SCENARIO.RUNNER_COMMAND_CONTRACT
    ]

    assert ordinals == sorted(ordinals)
    assert set(ordinals) == set(range(len(SCENARIO.RUNNER_PHASES)))


def test_runner_scenario_commands_are_the_exact_manifest_step_order() -> None:
    scenario_identities = [
        command["identity"]
        for command in SCENARIO.RUNNER_COMMAND_CONTRACT
        if command["phase"] == "scenario"
    ]
    step_identities = [step["identity"] for step in _shipped_manifest()["steps"]]

    assert scenario_identities == step_identities


def test_runner_script_is_adjacent_digest_pinned_and_not_executable() -> None:
    assert RUNNER.parent == SCRIPT.parent
    assert SCENARIO.RUNNER_SCRIPT_PATH == RUNNER
    assert SCENARIO.RUNNER_SCRIPT_SHA256 == (
        hashlib.sha256(RUNNER.read_bytes()).hexdigest()
    )
    assert not RUNNER.stat().st_mode & 0o111


def test_runner_script_declares_every_contract_identity_in_exact_order() -> None:
    text = RUNNER.read_text(encoding="utf-8")
    positions = [
        text.index(command["identity"]) for command in SCENARIO.RUNNER_COMMAND_CONTRACT
    ]

    assert positions == sorted(positions)
    for command in SCENARIO.RUNNER_COMMAND_CONTRACT:
        assert text.count(command["identity"]) == 1


def test_runner_script_is_authored_not_run_and_fails_closed() -> None:
    text = RUNNER.read_text(encoding="utf-8")

    assert "AUTHORED NOT RUN" in text
    assert "set -euo pipefail" in text
    assert "CYBRIK_D2_RUNTIME_AUTHORIZATION" in text
    assert "EXIT_UNAUTHORIZED=3" in text
    assert "cybrik_refuse" in text
    for forbidden in ("docker run", "psql ", "curl ", "pip install", "uv sync"):
        assert forbidden not in text


def test_report_embeds_the_runner_contract_as_authored_not_run(tmp_path: Path) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    contract = report["runner_contract"]
    assert code == 1
    assert contract["contract_version"] == SCENARIO.RUNNER_CONTRACT_VERSION
    assert contract["execution_status"] == "authored_not_run"
    assert contract["runner_sha256"] == SCENARIO.RUNNER_SCRIPT_SHA256
    assert contract["runtime_executed"] is False
    assert [command["identity"] for command in contract["commands"]] == [
        command["identity"] for command in SCENARIO.RUNNER_COMMAND_CONTRACT
    ]
    assert "runner_command_contract_not_run" in report["blockers"]


def test_the_runner_blocker_is_cleared_only_by_an_executed_runner(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(SCENARIO, "RUNNER_EXECUTION_STATUS", "executed")

    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert "runner_command_contract_not_run" not in report["blockers"]
    assert report["runner_contract"]["execution_status"] == "executed"


def test_a_tampered_runner_script_fails_closed_and_writes_nothing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    drifted = tmp_path / "run_prefounder_integrated_uat.sh"
    drifted.write_bytes(RUNNER.read_bytes() + b"# drift\n")
    monkeypatch.setattr(SCENARIO, "RUNNER_SCRIPT_PATH", drifted)

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == "runner_command_contract_invalid"
    assert not report_path.exists()


@pytest.mark.parametrize(
    "tamper",
    (
        pytest.param(lambda contract: contract[:-1], id="dropped-terminal-command"),
        pytest.param(
            lambda contract: (contract[-1], *contract[1:]), id="phases-out-of-order"
        ),
        pytest.param(
            lambda contract: (*contract[:-1], {**contract[-1], "order": 99}),
            id="non-contiguous-order",
        ),
        pytest.param(
            lambda contract: (*contract[:-1], {**contract[-1], "phase": "runtime"}),
            id="unknown-phase",
        ),
        pytest.param(
            lambda contract: (*contract[:-1], {**contract[-1], "extra": True}),
            id="unknown-command-field",
        ),
        pytest.param(
            lambda contract: (
                *contract[:-1],
                {**contract[-1], "identity": contract[0]["identity"]},
            ),
            id="duplicate-identity",
        ),
    ),
)
def test_a_tampered_runner_contract_fails_closed_and_writes_nothing(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    tamper: object,
) -> None:
    monkeypatch.setattr(
        SCENARIO, "RUNNER_COMMAND_CONTRACT", tamper(SCENARIO.RUNNER_COMMAND_CONTRACT)
    )

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == "runner_command_contract_invalid"
    assert not report_path.exists()


def test_a_scenario_command_that_leaves_the_manifest_order_fails_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    document = _shipped_manifest()
    document["steps"][0]["identity"] = "soc-lifecycle-create-request-renamed"
    _use_manifest(monkeypatch, tmp_path, document)

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == "runner_command_contract_invalid"
    assert not report_path.exists()


def test_operator_guide_is_bound_to_the_current_dry_pre_uat_contract() -> None:
    guide = OPERATOR_GUIDE.read_text(encoding="utf-8")

    assert SCENARIO.INTEGRATED_SCENARIO_SCHEMA_VERSION in guide
    assert SCENARIO.INTEGRATED_SCENARIO_MANIFEST_SHA256 in guide
    assert SCENARIO.OBSERVATIONS_SCHEMA_VERSION in guide
    assert SCENARIO.RUNNER_CONTRACT_VERSION in guide
    assert SCENARIO.RUNNER_SCRIPT_SHA256 in guide
    assert "run_prefounder_integrated_uat.sh" in guide
    assert '"tool_fabric_runtime_receipt"' in guide
    assert "embeds no mutable test count" in guide
    for step in SCENARIO.EXECUTION_PLAN:
        assert f"`{step['action']}`" in guide
    for case_id, _ in SCENARIO.REQUIRED_NEGATIVE_CASE_PURPOSES:
        assert case_id in guide
    assert "F1" in guide
    assert "F2" in guide


# ---------------------------------------------------------------------------
# Fabric ownership repair: Suite carries contracts, never Fabric runtime code
# ---------------------------------------------------------------------------


def test_dry_contract_contains_no_suite_owned_fabric_runtime_adapter() -> None:
    source = SCRIPT.read_text(encoding="utf-8")
    manifest = MANIFEST.read_text(encoding="utf-8")
    guide = OPERATOR_GUIDE.read_text(encoding="utf-8")

    assert "tool_fabric_adapter" not in source
    assert "tool_fabric_adapter" not in manifest
    assert "tool_fabric_adapter" not in guide
    assert "tool_fabric_adapter.py" not in source
    assert "tool_fabric_adapter.py" not in manifest
    assert "tool_fabric_adapter.py" not in guide
    assert "Suite-owned Tool Fabric" not in source
    assert "Suite-owned Tool Fabric" not in manifest
    assert "Suite-owned Tool Fabric" not in guide
    assert not hasattr(SCENARIO, "TOOL_FABRIC_ADAPTER_REL")
    assert not hasattr(SCENARIO, "ADMITTED_TOOL_FABRIC_ADAPTER_SHA256")


def test_observations_cannot_claim_a_suite_local_fabric_adapter() -> None:
    assert "tool_fabric_adapter" not in _observations()
    assert "tool_fabric_adapter" not in SCENARIO._TOP_FIELDS


def test_manifest_assigns_all_runtime_responsibility_to_fabric_and_discloses_limits() -> (
    None
):
    fabric = _shipped_manifest()["tool_fabric_runtime"]

    assert fabric["responsibility"] == {
        "execution": "cybrik-security-tool-fabric",
        "invocation": "cybrik-security-tool-fabric",
        "policy": "cybrik-security-tool-fabric",
        "receipt": "cybrik-security-tool-fabric",
    }
    assert fabric["current_invocation_boundary"] == (
        "in_process_R0AlertContextInvocationService.invoke"
    )
    assert fabric["current_receipt_form"] == "unsigned_ReceiptPlan"
    assert fabric["receipt_signature_envelope"] == "proposed_not_implemented"
    assert fabric["runtime_wiring_status"] == "not_wired"
    assert fabric["runtime_receipt_producer_status"] == "not_implemented"
    assert "path" not in fabric
    assert "digest" not in fabric
    assert "endpoint" not in fabric
    assert "signer" not in fabric


def test_fabric_runtime_producer_gap_is_manifest_derived_and_receipt_gate_is_distinct(
    tmp_path: Path,
) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert report["status"] == "HOLD"
    assert "tool_fabric_runtime_producer_absent" in report["blockers"]
    assert "tool_fabric_runtime_receipt_absent" in report["blockers"]
    assert "tool_fabric_adapter_absent" not in report["blockers"]
    assert "tool_fabric_adapter" not in report
    assert (
        report["integrated_scenario"]["tool_fabric_runtime"]
        == (_shipped_manifest()["tool_fabric_runtime"])
    )


def test_status_edits_cannot_fabricate_a_fabric_runtime_producer(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = _shipped_manifest()
    document["tool_fabric_runtime"]["runtime_wiring_status"] = "wired_and_run"
    document["tool_fabric_runtime"]["runtime_receipt_producer_status"] = (
        "implemented_and_run"
    )
    for product in document["products"]:
        if product["repository"] == "cybrik-security-tool-fabric":
            for wiring in product["runtime_wiring"]:
                wiring["status"] = "wired_and_run"
    for step in document["steps"]:
        if step["producer"] == "cybrik-security-tool-fabric":
            step["status"] = "implemented_and_run"
    _use_manifest(monkeypatch, tmp_path, document)

    code, _, report_path = _assess(tmp_path, _observations())

    assert code == 2
    assert capsys.readouterr().err.strip() == "integrated_scenario_invalid"
    assert not report_path.exists()


def test_file_presence_and_legacy_observation_claims_cannot_fabricate_a_producer(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    suite_root, report_path = _roots(tmp_path)
    obsolete = (
        suite_root / "integration/compose/soc-ai-lifecycle-create-mtls/src/"
        "cybrik_suite_uat_mtls/tool_fabric_adapter.py"
    )
    obsolete.parent.mkdir(parents=True)
    obsolete.write_text("# invented Suite runtime artifact\n", encoding="utf-8")
    observations_path = _write_observations(tmp_path, _observations())

    code = _run(suite_root, observations_path, report_path)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert report["status"] == "HOLD"
    assert "tool_fabric_runtime_producer_absent" in report["blockers"]
    assert "tool_fabric_runtime_receipt_absent" in report["blockers"]
    assert "tool_fabric_adapter" not in report

    second = tmp_path / "legacy-claim"
    second.mkdir()
    claimed = _observations()
    claimed["tool_fabric_adapter"] = {"claimed_present": True}
    claimed_code, _, claimed_report = _assess(second, claimed)
    assert claimed_code == 2
    assert capsys.readouterr().err.strip() == "observations_schema_invalid"
    assert not claimed_report.exists()


def test_synthetic_attestation_never_clears_the_fabric_producer_or_receipt_gates(
    tmp_path: Path,
) -> None:
    path, digest = _write_attestation(tmp_path, _attestation())

    code, _, report_path = _assess(tmp_path, _observations(), *_flags(path, digest))

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert code == 1
    assert "tool_fabric_runtime_producer_absent" in report["blockers"]
    assert "tool_fabric_runtime_receipt_absent" in report["blockers"]
    assert report["prefounder_rehearsal"]["grants_runtime_evidence"] is False
    assert "tool_fabric_runtime" not in report["prefounder_rehearsal"]


def test_execution_plan_names_a_fabric_owned_runtime_implementation_action() -> None:
    producer_step = next(
        step
        for step in SCENARIO.EXECUTION_PLAN
        if "tool_fabric_runtime_producer_absent" in step["clears"]
    )

    assert producer_step["action"] == "implement_fabric_owned_runtime_producer"
    assert "cybrik-security-tool-fabric" in producer_step["instruction"]
    assert SCENARIO.EXECUTION_PLAN[-1]["action"] == (
        "admit_real_tool_fabric_runtime_receipt"
    )
    assert SCENARIO.EXECUTION_PLAN[-1]["clears"] == (
        "tool_fabric_runtime_receipt_absent",
    )


def test_dry_assessment_and_runtime_launch_admission_are_distinct_runner_gates() -> (
    None
):
    identities = [command["identity"] for command in SCENARIO.RUNNER_COMMAND_CONTRACT]
    dry = next(
        command
        for command in SCENARIO.RUNNER_COMMAND_CONTRACT
        if command["identity"] == "run-prefounder-dry-assessment"
    )
    launch = next(
        command
        for command in SCENARIO.RUNNER_COMMAND_CONTRACT
        if command["identity"] == "require-runtime-launch-admission"
    )

    assert identities.index(dry["identity"]) < identities.index(launch["identity"])
    assert identities.index(launch["identity"]) < identities.index(
        _shipped_manifest()["steps"][0]["identity"]
    )
    assert "expected HOLD" in dry["requirement"]
    assert "zero runtime-launch blockers" in launch["requirement"]
    assert "runner_command_contract_not_run" not in SCENARIO.RUNTIME_LAUNCH_BLOCKERS
    assert "integrated_step_not_run" not in SCENARIO.RUNTIME_LAUNCH_BLOCKERS
    assert "negative_case_not_run" not in SCENARIO.RUNTIME_LAUNCH_BLOCKERS
    assert "terminal_evidence_not_captured" not in SCENARIO.RUNTIME_LAUNCH_BLOCKERS
    assert "tool_fabric_runtime_receipt_absent" not in SCENARIO.RUNTIME_LAUNCH_BLOCKERS


def test_report_keeps_dry_hold_distinct_from_runtime_launch_admission(
    tmp_path: Path,
) -> None:
    code, _, report_path = _assess(tmp_path, _observations())

    report = json.loads(report_path.read_text(encoding="utf-8"))
    expected = sorted(set(report["blockers"]) & set(SCENARIO.RUNTIME_LAUNCH_BLOCKERS))
    assert code == 1
    assert report["status"] == "HOLD"
    assert report["runtime_launch"] == {"admitted": False, "blockers": expected}
    assert "runner_command_contract_not_run" not in expected
    assert "tool_fabric_runtime_receipt_absent" not in expected


def test_observations_symlink_and_hardlink_fail_closed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    suite_root, report_path = _roots(tmp_path)
    regular = _write_observations(tmp_path, _observations())
    symlink = tmp_path / "observations-link.json"
    symlink.symlink_to(regular)

    symlink_code = _run(suite_root, symlink, report_path)
    assert symlink_code == 2
    assert capsys.readouterr().err.strip() == "observations_json_invalid"
    assert not report_path.exists()

    hard_root = tmp_path / "hard"
    hard_root.mkdir()
    suite_root, report_path = _roots(hard_root)
    hard = hard_root / "observations-hard.json"
    os.link(regular, hard)

    hard_code = _run(suite_root, hard, report_path)
    assert hard_code == 2
    assert capsys.readouterr().err.strip() == "observations_json_invalid"
    assert not report_path.exists()


def test_observations_are_read_once_through_the_identity_stable_descriptor(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = _write_observations(tmp_path, _observations())
    original = SCENARIO._read_exact_bytes
    calls: list[Path] = []

    def tracked(candidate: Path, **kwargs: object) -> bytes:
        calls.append(candidate)
        return original(candidate, **kwargs)

    monkeypatch.setattr(SCENARIO, "_read_exact_bytes", tracked)

    loaded = SCENARIO._load_observations(path)

    assert loaded == _observations()
    assert calls == [path]


def test_observations_changed_during_the_descriptor_read_fail_closed(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    suite_root, report_path = _roots(tmp_path)
    observations_path = _write_observations(tmp_path, _observations())
    original_fstat = SCENARIO.os.fstat
    calls = 0

    def changed_identity(descriptor: int) -> os.stat_result:
        nonlocal calls
        calls += 1
        result = original_fstat(descriptor)
        if calls == 2:
            fields = list(result)
            fields[6] += 1
            return os.stat_result(fields)
        return result

    monkeypatch.setattr(SCENARIO.os, "fstat", changed_identity)

    code = _run(suite_root, observations_path, report_path)

    assert code == 2
    assert capsys.readouterr().err.strip() == "observations_json_invalid"
    assert not report_path.exists()


def test_operator_guide_has_no_unbound_verification_result_claims() -> None:
    guide = OPERATOR_GUIDE.read_text(encoding="utf-8")

    assert not re.search(r"\b\d+ passed in \d+(?:\.\d+)?s\b", guide)
    assert "ruff: All checks passed" not in guide
