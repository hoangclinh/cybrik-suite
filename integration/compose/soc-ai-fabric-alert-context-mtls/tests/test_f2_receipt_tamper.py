"""F2: copied receipt materialization tamper fails closed and preserves authority."""

from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path

from cybrik_fabric_control.invocation.fsync_journal import FsyncAppendOnlyReceiptJournal
from cybrik_fabric_control.runtime_adapters import ProcessLocalFsyncReceiptReader
from cybrik_fabric_control.runtime_routes import ReceiptReadDisposition
from test_fabric_composition import asgi_request, build_composition


def _snapshot(root: Path) -> dict[Path, bytes]:
    return {
        path.relative_to(root): path.read_bytes()
        for path in sorted(root.rglob("*.json"))
    }


def test_copied_materialization_tamper_is_unverifiable_and_authority_is_unchanged(
    tmp_path: Path,
) -> None:
    authoritative_root = tmp_path / "authoritative"
    composition, request, principal, _soc, _dispatch, identity = build_composition(
        authoritative_root
    )
    created = asyncio.run(
        asgi_request(
            composition,
            "POST",
            "/api/v1/invocations",
            headers={"Idempotency-Key": request["idempotency_key"]},
            json=request,
        )
    )
    receipt_id = created.json()["receipt_id"]
    before = _snapshot(authoritative_root)

    copied_root = tmp_path / "copied"
    shutil.copytree(authoritative_root, copied_root)
    receipt_path = next(
        (copied_root / "tenants" / request["tenant_id"] / "receipt").glob("*.json")
    )
    copied = json.loads(receipt_path.read_text(encoding="utf-8"))
    copied["payload"]["materialization"]["receipt"]["status"] = "failed"
    receipt_path.write_text(
        json.dumps(copied, separators=(",", ":"), sort_keys=True),
        encoding="utf-8",
    )
    copied_reader = ProcessLocalFsyncReceiptReader(
        journal=FsyncAppendOnlyReceiptJournal(copied_root),
        verifier=identity,
        retention=composition.retention,
    )

    lookup = copied_reader.get_receipt(
        receipt_id,
        tenant_id=principal.tenant_id,
        principal=principal,
    )

    assert lookup.disposition is ReceiptReadDisposition.UNVERIFIABLE
    assert lookup.receipt is None
    assert _snapshot(authoritative_root) == before
