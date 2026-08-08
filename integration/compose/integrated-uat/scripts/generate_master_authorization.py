"""Fail-closed entrypoint for preparing an unsigned master UAT packet."""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class GeneratorDependencies:
    """Effects used only after the exact opt-in command has been validated."""

    prepare_master_authorization: Callable[..., Any]
    write_prepared_authorization: Callable[..., None]


@dataclass(frozen=True)
class _EmitArguments:
    authorization_id: str
    authorized_by: str
    issued_at: datetime
    expires_at: datetime
    payload_path: Path
    receipt_path: Path


_OPTION_NAMES = (
    "--authorization-id",
    "--authorized-by",
    "--issued-at",
    "--expires-at",
    "--payload-output",
    "--receipt-output",
)


def _print_document(document: Mapping[str, object]) -> None:
    print(json.dumps(document, sort_keys=True, separators=(",", ":")))


def _hold() -> int:
    _print_document(
        {
            "execution_authorized": False,
            "reason": "external_exact_authorization_absent",
            "status": "HOLD",
        }
    )
    return 2


def _aware_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError
    return parsed


def _parse_emit(arguments: list[str]) -> _EmitArguments | None:
    if not arguments or arguments[0] != "emit":
        return None
    option_values = arguments[1:]
    if len(option_values) != len(_OPTION_NAMES) * 2:
        return None

    parsed: dict[str, str] = {}
    for index in range(0, len(option_values), 2):
        name, value = option_values[index : index + 2]
        if name not in _OPTION_NAMES or name in parsed or not value:
            return None
        parsed[name] = value
    if set(parsed) != set(_OPTION_NAMES):
        return None

    try:
        return _EmitArguments(
            authorization_id=parsed["--authorization-id"],
            authorized_by=parsed["--authorized-by"],
            issued_at=_aware_datetime(parsed["--issued-at"]),
            expires_at=_aware_datetime(parsed["--expires-at"]),
            payload_path=Path(parsed["--payload-output"]),
            receipt_path=Path(parsed["--receipt-output"]),
        )
    except (OSError, TypeError, ValueError):
        return None


def _source_root() -> Path:
    script = Path(__file__).resolve(strict=True)
    root = script.parent.parent / "src"
    if root.is_symlink() or not root.is_dir() or root.resolve(strict=True) != root:
        raise RuntimeError
    return root


def _default_dependencies() -> GeneratorDependencies:
    source_root = _source_root()
    sys.path.insert(0, str(source_root))
    from cybrik_suite_integrated_uat import preparation

    origin = Path(preparation.__file__).resolve(strict=True)
    if not origin.is_relative_to(source_root):
        raise RuntimeError
    return GeneratorDependencies(
        prepare_master_authorization=preparation.prepare_master_authorization,
        write_prepared_authorization=preparation.write_prepared_authorization,
    )


def main(
    argv: list[str] | None = None,
    *,
    environment: Mapping[str, str] | None = None,
    dependencies: GeneratorDependencies | None = None,
) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    parsed = _parse_emit(arguments)
    if parsed is None:
        return _hold()

    try:
        effects = dependencies if dependencies is not None else _default_dependencies()
        source_environment = os.environ if environment is None else environment
        prepared = effects.prepare_master_authorization(
            source_environment,
            authorization_id=parsed.authorization_id,
            authorized_by=parsed.authorized_by,
            issued_at=parsed.issued_at,
            expires_at=parsed.expires_at,
        )
        effects.write_prepared_authorization(
            prepared,
            payload_path=parsed.payload_path,
            receipt_path=parsed.receipt_path,
        )
    except (AttributeError, ImportError, OSError, RuntimeError, TypeError, ValueError):
        return _hold()

    _print_document(
        {
            "authorization_payload": str(parsed.payload_path),
            "preparation_receipt": str(parsed.receipt_path),
            "status": "PREPARED_UNSIGNED",
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
