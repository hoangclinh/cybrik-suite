"""Pinned entrypoint for the master-reserved alert-context UAT stage."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path


def _source_root() -> Path:
    script = Path(__file__).resolve(strict=True)
    root = script.parent.parent / "src"
    if not root.is_dir() or root.is_symlink():
        raise SystemExit(2)
    return root


sys.path.insert(0, str(_source_root()))

_stage = importlib.import_module("cybrik_suite_uat_fabric.integrated_stage")


if __name__ == "__main__":
    try:
        raise SystemExit(_stage.main())
    except _stage.IntegratedStageFailure:
        raise SystemExit(2) from None
