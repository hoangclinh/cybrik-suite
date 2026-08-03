"""Concrete HTTP/filesystem adapters for positive, F1 and F2 UAT cases.

The mTLS configuration of each client is created by the outer runtime wiring.
This module narrows those clients to exact routes and converts runtime
observations into :class:`runtime_cases.RuntimeCaseDependencies`.
"""

from __future__ import annotations

import copy
import hashlib
import os
import shutil
import stat
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from .runtime_cases import CounterSnapshot, RuntimeCaseDependencies

_POSITIVE_ROUTE = "/uat/v1/summarizations"
_F1_ROUTE = "/api/v1/invocations"
_METRICS_ROUTE = "/uat/v1/metrics"


class RuntimeCaseWiringError(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class HttpResponse(Protocol):
    status_code: int

    def json(self) -> object: ...


class HttpClient(Protocol):
    def post(self, path: str, **kwargs: Any) -> HttpResponse: ...

    def get(self, path: str) -> HttpResponse: ...


ReceiptProbe = Callable[[], Mapping[str, object]]
TamperProbe = Callable[[Path], Mapping[str, object]]


@dataclass(frozen=True, slots=True)
class RuntimeCaseWiring:
    positive_client: HttpClient
    f1_client: HttpClient
    soc_metrics_client: HttpClient
    ai_metrics_client: HttpClient
    positive_request: Mapping[str, object]
    f1_request: Mapping[str, object]
    journal_root: Path
    scratch_root: Path
    authoritative_receipt_probe: ReceiptProbe
    copied_receipt_tamper_probe: TamperProbe


def _response_document(response: object, reason: str) -> dict[str, object]:
    try:
        document = response.json()  # type: ignore[union-attr]
    except Exception:  # noqa: BLE001 - injected HTTP detail is collapsed.
        raise RuntimeCaseWiringError(reason) from None
    if not isinstance(document, Mapping):
        raise RuntimeCaseWiringError(reason)
    return copy.deepcopy(dict(document))


def read_metric(client: HttpClient, name: str) -> int:
    """Read one authenticated exact-shape UAT metric."""

    if name not in {"soc_calls", "model_calls"}:
        raise RuntimeCaseWiringError("metrics_invalid")
    try:
        response = client.get(_METRICS_ROUTE)
    except Exception:  # noqa: BLE001 - transport detail is not reflected.
        raise RuntimeCaseWiringError("metrics_invalid") from None
    document = _response_document(response, "metrics_invalid")
    value = document.get(name)
    if (
        getattr(response, "status_code", None) != 200
        or set(document) != {name}
        or isinstance(value, bool)
        or not isinstance(value, int)
        or value < 0
    ):
        raise RuntimeCaseWiringError("metrics_invalid")
    return value


def _stable_file(path: Path) -> bytes:
    if path.is_symlink():
        raise RuntimeCaseWiringError("journal_snapshot_invalid")
    try:
        descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    except OSError as exc:
        raise RuntimeCaseWiringError("journal_snapshot_invalid") from exc
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
            raise RuntimeCaseWiringError("journal_snapshot_invalid")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(descriptor, 64 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        after = os.fstat(descriptor)
        if (before.st_dev, before.st_ino, before.st_size) != (
            after.st_dev,
            after.st_ino,
            after.st_size,
        ):
            raise RuntimeCaseWiringError("journal_snapshot_invalid")
        payload = b"".join(chunks)
        if len(payload) != before.st_size:
            raise RuntimeCaseWiringError("journal_snapshot_invalid")
        return payload
    finally:
        os.close(descriptor)


def snapshot_journal(root: Path) -> str:
    """Hash relative names plus stable bytes for the authoritative journal."""

    if not isinstance(root, Path) or not root.is_absolute():
        raise RuntimeCaseWiringError("journal_snapshot_invalid")
    try:
        resolved = root.resolve(strict=True)
    except OSError as exc:
        raise RuntimeCaseWiringError("journal_snapshot_invalid") from exc
    if resolved != root or not root.is_dir() or root.is_symlink():
        raise RuntimeCaseWiringError("journal_snapshot_invalid")
    framed: list[bytes] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise RuntimeCaseWiringError("journal_snapshot_invalid")
        if path.is_dir():
            continue
        relative = path.relative_to(root).as_posix()
        payload = _stable_file(path)
        framed.append(
            relative.encode("utf-8")
            + b"\0"
            + hashlib.sha256(payload).hexdigest().encode("ascii")
            + b"\n"
        )
    return hashlib.sha256(b"".join(framed)).hexdigest()


def _positive(wiring: RuntimeCaseWiring) -> Mapping[str, object]:
    try:
        response = wiring.positive_client.post(
            _POSITIVE_ROUTE, json=copy.deepcopy(dict(wiring.positive_request))
        )
    except Exception:  # noqa: BLE001 - injected transport detail is collapsed.
        raise RuntimeCaseWiringError("positive_request_failed") from None
    document = _response_document(response, "positive_request_failed")
    if (
        getattr(response, "status_code", None) != 200
        or document.get("outcome") != "completed"
    ):
        raise RuntimeCaseWiringError("positive_request_failed")
    try:
        proof = wiring.authoritative_receipt_probe()
    except Exception:  # noqa: BLE001 - verifier detail is collapsed.
        raise RuntimeCaseWiringError("receipt_probe_failed") from None
    if not isinstance(proof, Mapping):
        raise RuntimeCaseWiringError("receipt_probe_failed")
    return copy.deepcopy(dict(proof))


def _f1(wiring: RuntimeCaseWiring) -> HttpResponse:
    body = copy.deepcopy(dict(wiring.f1_request))
    key = body.get("idempotency_key")
    if not isinstance(key, str) or len(key) < 16:
        raise RuntimeCaseWiringError("f1_request_invalid")
    try:
        return wiring.f1_client.post(
            _F1_ROUTE,
            json=body,
            headers={"Idempotency-Key": key},
        )
    except Exception:  # noqa: BLE001 - injected transport detail is collapsed.
        raise RuntimeCaseWiringError("f1_request_failed") from None


def _counters(wiring: RuntimeCaseWiring) -> CounterSnapshot:
    return CounterSnapshot(
        soc_calls=read_metric(wiring.soc_metrics_client, "soc_calls"),
        model_calls=read_metric(wiring.ai_metrics_client, "model_calls"),
    )


def _f2(wiring: RuntimeCaseWiring) -> Mapping[str, object]:
    scratch = wiring.scratch_root
    if (
        not isinstance(scratch, Path)
        or not scratch.is_absolute()
        or scratch == wiring.journal_root
        or scratch.is_relative_to(wiring.journal_root)
        or scratch.exists()
        or scratch.is_symlink()
    ):
        raise RuntimeCaseWiringError("scratch_root_invalid")
    try:
        # ``snapshot_journal`` rejects every symlink before the bounded copy.
        snapshot_journal(wiring.journal_root)
        shutil.copytree(wiring.journal_root, scratch, symlinks=False)
        scratch.chmod(0o700)
        result = wiring.copied_receipt_tamper_probe(scratch)
        if not isinstance(result, Mapping):
            raise RuntimeCaseWiringError("tamper_probe_failed")
        return copy.deepcopy(dict(result))
    except RuntimeCaseWiringError:
        raise
    except Exception:  # noqa: BLE001 - copied-journal probe detail is collapsed.
        raise RuntimeCaseWiringError("tamper_probe_failed") from None
    finally:
        if scratch.exists() and not scratch.is_symlink():
            shutil.rmtree(scratch)


def build_runtime_case_dependencies(
    wiring: RuntimeCaseWiring,
) -> RuntimeCaseDependencies:
    if not isinstance(wiring, RuntimeCaseWiring):
        raise TypeError("runtime case wiring is invalid")
    return RuntimeCaseDependencies(
        run_positive_request=lambda: _positive(wiring),
        run_f1_request=lambda: _f1(wiring),
        run_copied_receipt_tamper=lambda: _f2(wiring),
        snapshot_counters=lambda: _counters(wiring),
        snapshot_authoritative_journal=lambda: snapshot_journal(wiring.journal_root),
    )


__all__ = [
    "RuntimeCaseWiring",
    "RuntimeCaseWiringError",
    "build_runtime_case_dependencies",
    "read_metric",
    "snapshot_journal",
]
