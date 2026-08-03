from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parents[1]
SCRIPT = ROOT / "scripts/run_integrated_uat.py"
HOLD = b'{"execution_authorized":false,"reason":"external_exact_authorization_absent","status":"HOLD"}\n'


def test_script_defaults_to_hold_without_importing_bootstrap() -> None:
    result = subprocess.run(
        (sys.executable, "-B", "-P", str(SCRIPT)),
        check=False,
        capture_output=True,
        timeout=10,
    )

    assert result.returncode == 2
    assert result.stdout == HOLD
    assert result.stderr == b""


def test_script_rejects_everything_except_exact_execute() -> None:
    result = subprocess.run(
        (sys.executable, "-B", "-P", str(SCRIPT), "--execute", "extra"),
        check=False,
        capture_output=True,
        timeout=10,
    )

    assert result.returncode == 2
    assert result.stdout == HOLD
    assert result.stderr == b""
