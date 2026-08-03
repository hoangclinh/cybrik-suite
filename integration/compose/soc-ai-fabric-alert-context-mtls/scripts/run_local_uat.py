"""UAT-only entrypoint; resolve this checkout and otherwise fail closed."""

from __future__ import annotations

import json
import sys
from collections.abc import Callable
from pathlib import Path

HOLD_EXIT_STATUS = 2


def _hold(reason: str) -> int:
    print(
        json.dumps(
            {
                "execution_authorized": False,
                "reason": reason,
                "status": "HOLD",
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )
    return HOLD_EXIT_STATUS


def _local_main() -> Callable[[list[str] | None], int] | None:
    source = Path(__file__).resolve().parents[1] / "src"
    try:
        resolved = source.resolve(strict=True)
    except OSError:
        return None
    if resolved != source or not source.is_dir():
        return None
    sys.path.insert(0, str(source))
    try:
        from cybrik_suite_uat_fabric import runtime_bootstrap
    except Exception:  # noqa: BLE001 - standalone bootstrap exposes only stable HOLD.
        return None
    module_path = Path(runtime_bootstrap.__file__).resolve()
    if not module_path.is_relative_to(source):
        return None
    return runtime_bootstrap.main


def _entrypoint(argv: list[str] | None = None) -> int:
    main = _local_main()
    if main is None:
        return _hold("local_source_unavailable")
    return main(sys.argv[1:] if argv is None else argv)


if __name__ == "__main__":
    raise SystemExit(_entrypoint())
