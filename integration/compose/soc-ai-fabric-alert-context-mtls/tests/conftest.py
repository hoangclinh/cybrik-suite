from __future__ import annotations

import sys
from pathlib import Path


def _install_local_roots() -> None:
    harness_root = Path(__file__).resolve().parents[1]
    source_root = harness_root / "src"
    sys.path.insert(0, str(source_root))
    from cybrik_suite_uat_fabric.bootstrap import bootstrap_local_imports

    bootstrap_local_imports(Path(__file__))


_install_local_roots()
