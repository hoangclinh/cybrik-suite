"""Exact opt-in entrypoint for the Suite-owned integrated UAT."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def _hold() -> int:
    print(
        json.dumps(
            {
                "execution_authorized": False,
                "reason": "external_exact_authorization_absent",
                "status": "HOLD",
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    return 2


def _source_root() -> Path:
    script = Path(__file__).resolve(strict=True)
    root = script.parent.parent / "src"
    if root.is_symlink() or not root.is_dir() or root.resolve(strict=True) != root:
        raise RuntimeError
    return root


def main(argv: list[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    if arguments != ["--execute"]:
        return _hold()
    try:
        source_root = _source_root()
        sys.path.insert(0, str(source_root))
        from cybrik_suite_integrated_uat import bootstrap

        origin = Path(bootstrap.__file__).resolve(strict=True)
        if not origin.is_relative_to(source_root):
            return _hold()
    except (AttributeError, ImportError, OSError, RuntimeError, TypeError):
        return _hold()
    return bootstrap.main(["--execute"])


if __name__ == "__main__":
    raise SystemExit(main())
