from __future__ import annotations

import stat
from pathlib import Path

from cybrik_suite_integrated_uat import (
    EXPECTED_PORTS,
    EXPECTED_REPOSITORIES,
    AlertContextStage,
    CommonTeardown,
    EnvironmentInspector,
    PostgresD2Stage,
)

ROOT = Path(__file__).parents[1]


def test_exact_repository_and_port_contract_is_frozen() -> None:
    assert EXPECTED_REPOSITORIES == (
        "cybrik-soc-command-center",
        "cybrik-cyber-ai-platform",
        "cybrik-security-tool-fabric",
        "cybrik-suite",
    )
    assert EXPECTED_PORTS == (55432, 58442, 58443, 58444)


def test_only_injected_child_protocols_are_exposed() -> None:
    assert getattr(PostgresD2Stage, "_is_protocol", False)
    assert getattr(AlertContextStage, "_is_protocol", False)
    assert getattr(CommonTeardown, "_is_protocol", False)
    assert getattr(EnvironmentInspector, "_is_protocol", False)

    contract_text = "\n".join(
        (ROOT / "src/cybrik_suite_integrated_uat" / name).read_text(encoding="utf-8")
        for name in ("models.py", "orchestrator.py", "protocols.py", "storage.py")
    )
    assert "RealPostgresD2Adapter" not in contract_text
    for forbidden in ("subprocess", "socket", "docker run"):
        assert forbidden not in contract_text.lower()
    assert "assert " not in contract_text


def test_readme_is_status_honest_about_concrete_adapters_and_unrun_runtime() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    assert "IMPLEMENTED — STATICALLY VERIFIED — RUNTIME NOT RUN" in readme
    assert "concrete PostgreSQL D2 stage" in readme
    assert "concrete alert-context stage" in readme
    assert "No runtime attempt" in readme
    assert "SCAFFOLD" not in readme
    assert "REAL ADAPTERS NOT IMPLEMENTED" not in readme


def test_pyproject_has_no_runtime_dependency_or_executable_entrypoint() -> None:
    text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")

    assert "dependencies = []" in text
    assert "[project.scripts]" not in text
    assert "pytest" in text


def test_authored_surface_contains_no_executable_file() -> None:
    for path in ROOT.rglob("*"):
        if path.is_file():
            assert not stat.S_IMODE(path.stat().st_mode) & 0o111
