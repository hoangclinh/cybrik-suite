"""Inert preparation entrypoint for the G-U2B topology rehearsal grant.

Importing or running this script performs no I/O and authorizes no Docker effect, listener,
PostgreSQL attempt, UAT, demo, merge, release, or production action. It parses argv and
returns the fixed non-zero hold exit, because the preparation it names is not authorized.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

__all__ = ["HOLD_EXIT", "build_parser", "main"]

HOLD_EXIT = 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--prepare-unsigned", dest="prepare_unsigned", action="store_true")
    parser.add_argument("--output")
    return parser


def main(argv: Sequence[str]) -> int:
    try:
        build_parser().parse_args(list(argv))
    except SystemExit:
        return HOLD_EXIT
    return HOLD_EXIT


# Running the file must produce the hold exit the docstring promises. Without this guard the
# module defined `main`, never called it, and fell off the end with status 0 — the success
# code — so an operator who ran the script was told the preparation had succeeded when
# nothing had been parsed at all. The guard does not fire on import, so the inertness the
# front door advertises is unchanged.
if __name__ == "__main__":  # pragma: no cover - exercised by invocation, not by import
    raise SystemExit(main(sys.argv[1:]))
