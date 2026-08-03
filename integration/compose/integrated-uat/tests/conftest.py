from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "src"))

_SHORT_D2_ROOTS: set[Path] = set()


def register_short_d2_root(root: Path) -> None:
    _SHORT_D2_ROOTS.add(root)


@pytest.fixture(autouse=True)
def cleanup_short_d2_roots() -> object:
    before = set(_SHORT_D2_ROOTS)
    yield
    for root in _SHORT_D2_ROOTS - before:
        shutil.rmtree(root)
        _SHORT_D2_ROOTS.remove(root)
