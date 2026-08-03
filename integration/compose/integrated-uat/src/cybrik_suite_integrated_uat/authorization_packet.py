"""Pure canonical builder for the integrated-UAT master authorization packet."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from types import MappingProxyType
from typing import Final

MASTER_AUTHORIZATION_SCHEMA: Final = "CYBRIK-INTEGRATED-UAT-MASTER-AUTH/v1"
MASTER_AUTHORIZATION_FIELDS: Final = frozenset(
    (
        "authorization_id",
        "authorized_by",
        "b1_wheel",
        "decision",
        "evidence_root",
        "expires_at",
        "external_roots",
        "external_roots_sha256",
        "helper_scripts",
        "issued_at",
        "one_shot",
        "python",
        "repository_roots",
        "repository_roots_sha256",
        "schema",
        "tracked_blob_aggregate",
        "tuple",
    )
)


class AuthorizationPacketError(ValueError):
    """The supplied bindings cannot form a valid master authorization packet."""


def _freeze(value: object) -> object:
    if isinstance(value, Mapping):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return tuple(_freeze(item) for item in value)
    return value


def _thaw(value: object) -> object:
    if isinstance(value, Mapping):
        return {key: _thaw(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_thaw(item) for item in value]
    return value


@dataclass(frozen=True, slots=True)
class MasterBindingInputs:
    """All signer-visible bindings required by the master runtime verifier."""

    authorization_id: str
    authorized_by: str
    issued_at: datetime
    expires_at: datetime
    b1_wheel: Mapping[str, object]
    evidence_root: str
    external_roots: Sequence[Mapping[str, object]]
    external_roots_sha256: str
    helper_scripts: Sequence[Mapping[str, object]]
    python: Mapping[str, object]
    repository_roots: Sequence[Mapping[str, object]]
    repository_roots_sha256: str
    repository_tuple: Sequence[tuple[str, str, str]]
    tracked_blob_aggregate: Mapping[str, object]

    def __post_init__(self) -> None:
        for name in (
            "b1_wheel",
            "external_roots",
            "helper_scripts",
            "python",
            "repository_roots",
            "repository_tuple",
            "tracked_blob_aggregate",
        ):
            object.__setattr__(self, name, _freeze(getattr(self, name)))


def _utc_datetime(value: datetime) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise AuthorizationPacketError("timestamp_window_invalid")
    try:
        offset = value.utcoffset()
        normalized = value.astimezone(UTC)
    except (OverflowError, ValueError) as exc:
        raise AuthorizationPacketError("timestamp_window_invalid") from exc
    if offset is None:
        raise AuthorizationPacketError("timestamp_window_invalid")
    return normalized


def _timestamps(inputs: MasterBindingInputs) -> tuple[str, str]:
    issued_at = _utc_datetime(inputs.issued_at)
    expires_at = _utc_datetime(inputs.expires_at)
    if expires_at <= issued_at or expires_at - issued_at > timedelta(hours=24):
        raise AuthorizationPacketError("timestamp_window_invalid")
    return issued_at.isoformat(), expires_at.isoformat()


def master_document(inputs: MasterBindingInputs) -> dict[str, object]:
    """Return a fresh exact-schema document without performing external effects."""

    issued_at, expires_at = _timestamps(inputs)
    repository_tuple = {
        role: {"commit": commit, "tree": tree}
        for role, commit, tree in inputs.repository_tuple
    }
    document: dict[str, object] = {
        "authorization_id": inputs.authorization_id,
        "authorized_by": inputs.authorized_by,
        "b1_wheel": _thaw(inputs.b1_wheel),
        "decision": "APPROVE",
        "evidence_root": inputs.evidence_root,
        "expires_at": expires_at,
        "external_roots": _thaw(inputs.external_roots),
        "external_roots_sha256": inputs.external_roots_sha256,
        "helper_scripts": _thaw(inputs.helper_scripts),
        "issued_at": issued_at,
        "one_shot": True,
        "python": _thaw(inputs.python),
        "repository_roots": _thaw(inputs.repository_roots),
        "repository_roots_sha256": inputs.repository_roots_sha256,
        "schema": MASTER_AUTHORIZATION_SCHEMA,
        "tracked_blob_aggregate": _thaw(inputs.tracked_blob_aggregate),
        "tuple": repository_tuple,
    }
    if frozenset(document) != MASTER_AUTHORIZATION_FIELDS:
        raise AssertionError("master authorization schema drift")
    return document


def canonical_master_payload(inputs: MasterBindingInputs) -> bytes:
    """Serialize the exact master packet as deterministic UTF-8 JSON bytes."""

    return json.dumps(
        master_document(inputs),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def canonical_master_record(payload: bytes) -> dict[str, object]:
    """Parse only the exact canonical byte representation of the master packet."""

    try:
        record = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AuthorizationPacketError("json_invalid") from exc
    if (
        not isinstance(record, dict)
        or frozenset(record) != MASTER_AUTHORIZATION_FIELDS
        or json.dumps(
            record,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
        != payload
    ):
        raise AuthorizationPacketError("not_canonical")
    return record


def aware_utc_timestamp(value: object) -> datetime:
    """Parse an ISO-8601 value and require a timezone-aware instant."""

    if not isinstance(value, str):
        raise AuthorizationPacketError("timestamp_invalid")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise AuthorizationPacketError("timestamp_invalid") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise AuthorizationPacketError("timestamp_invalid")
    return parsed.astimezone(UTC)
