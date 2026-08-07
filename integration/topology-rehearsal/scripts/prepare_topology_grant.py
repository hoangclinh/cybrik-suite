"""Inert preparation entrypoint for the G-U2B topology rehearsal grant.

Importing or running this script performs no I/O and authorizes no Docker effect, listener,
PostgreSQL attempt, UAT, demo, merge, release, or production action. It parses argv and
returns the fixed non-zero hold exit, because the preparation it names is not authorized.
"""

from __future__ import annotations

import argparse
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
