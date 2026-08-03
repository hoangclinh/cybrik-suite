from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest
from cybrik_suite_uat_fabric import admission, runtime_wiring

_PRODUCT_PINS = {
    "soc": (
        Path(
            "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/soc-d2-runtime-tuple-r1"
        ),
        "abfdfde96afc6daa2868694de993c623daa8862e",
    ),
    "cyber_ai": (
        Path(
            "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/ai-d2-runtime-tuple-r1"
        ),
        "db2a18011072a521824d90783f0ccd4d120fa144",
    ),
    "tool_fabric": (
        Path(
            "/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w3-48/fabric-runtime-producer-r1"
        ),
        "50aff1df146d6e98b33d9f82617781595bcf1512",
    ),
}


def _git(root: Path, *arguments: str) -> str:
    return subprocess.run(
        ("/usr/bin/git", "-C", str(root), *arguments),
        check=True,
        capture_output=True,
        text=True,
        env={"LC_ALL": "C", "PATH": "/usr/bin:/bin"},
    ).stdout.strip()


def test_allowlist_aggregates_every_real_fixed_product_blob_and_current_suite_source(
    tmp_path: Path,
) -> None:
    if any(not root.is_dir() for root, _commit in _PRODUCT_PINS.values()):
        pytest.skip("fixed local UAT product worktrees are unavailable")
    suite_source = Path(__file__).resolve().parents[4]
    suite = tmp_path / "suite"
    suite.mkdir()
    for relative in runtime_wiring.TRACKED_ALLOWLIST["suite"]:
        source = suite_source / relative
        assert source.is_file(), f"missing Suite allowlist source: {relative}"
        destination = suite / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    _git(suite, "init", "-q")
    _git(suite, "add", ".")
    _git(
        suite,
        "-c",
        "user.name=UAT Test",
        "-c",
        "user.email=uat@example.invalid",
        "commit",
        "-q",
        "-m",
        "freeze suite allowlist fixture",
    )
    expectations = [
        admission.RepoExpectation(
            "suite",
            suite.resolve(),
            _git(suite, "rev-parse", "HEAD"),
            _git(suite, "rev-parse", "HEAD^{tree}"),
        )
    ]
    for role in ("soc", "cyber_ai", "tool_fabric"):
        root, commit = _PRODUCT_PINS[role]
        assert _git(root, "rev-parse", "HEAD") == commit
        expectations.append(
            admission.RepoExpectation(
                role, root.resolve(), commit, _git(root, "rev-parse", "HEAD^{tree}")
            )
        )

    observations = admission.observe_exact_tuple(tuple(expectations))
    aggregate = admission.tracked_blob_aggregate(
        observations, runtime_wiring.TRACKED_ALLOWLIST
    )

    assert aggregate.file_count == sum(
        len(paths) for paths in runtime_wiring.TRACKED_ALLOWLIST.values()
    )
    assert len(aggregate.sha256) == 64
