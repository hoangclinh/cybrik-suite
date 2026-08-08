from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

ROOT = Path(__file__).parents[1]
SCRIPT = ROOT / "scripts/generate_master_authorization.py"
HOLD = b'{"execution_authorized":false,"reason":"external_exact_authorization_absent","status":"HOLD"}\n'


def _load_script() -> ModuleType:
    if not SCRIPT.is_file():
        pytest.fail(
            "missing implementation: scripts/generate_master_authorization.py",
            pytrace=False,
        )
    spec = importlib.util.spec_from_file_location(
        "generate_master_authorization", SCRIPT
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _valid_argv(tmp_path: Path) -> list[str]:
    return [
        "emit",
        "--authorization-id",
        "master-uat-20260803-001",
        "--authorized-by",
        "FOUNDER",
        "--issued-at",
        "2026-08-03T00:00:00+00:00",
        "--expires-at",
        "2026-08-03T01:00:00+00:00",
        "--payload-output",
        str(tmp_path / "master-authorization.json"),
        "--receipt-output",
        str(tmp_path / "preparation-receipt.json"),
    ]


def test_script_defaults_to_inert_hold() -> None:
    result = subprocess.run(
        (sys.executable, "-B", "-P", str(SCRIPT)),
        check=False,
        capture_output=True,
        timeout=10,
    )

    assert result.returncode == 2
    assert result.stdout == HOLD
    assert result.stderr == b""


@pytest.mark.parametrize(
    "argv",
    (
        ("--emit",),
        ("prepare",),
        ("emit",),
        ("emit", "--private-key", "/secret/key"),
        ("emit", "--authorization-id", "run", "extra"),
    ),
)
def test_only_exact_emit_subcommand_with_reviewed_options_is_accepted(
    argv: tuple[str, ...],
) -> None:
    result = subprocess.run(
        (sys.executable, "-B", "-P", str(SCRIPT), *argv),
        check=False,
        capture_output=True,
        timeout=10,
    )

    assert result.returncode == 2
    assert result.stdout == HOLD
    assert result.stderr == b""


def test_no_args_never_invokes_injected_preparation_dependencies(
    capsys: pytest.CaptureFixture[str],
) -> None:
    module = _load_script()

    def forbidden(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("inert HOLD attempted preparation")

    dependencies = module.GeneratorDependencies(
        prepare_master_authorization=forbidden,
        write_prepared_authorization=forbidden,
    )

    assert module.main([], environment={}, dependencies=dependencies) == 2
    assert capsys.readouterr().out.encode() == HOLD


def test_emit_delegates_once_with_explicit_deterministic_values(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _load_script()
    calls: list[tuple[str, object]] = []
    prepared = SimpleNamespace(payload=b"canonical", receipt=b"receipt")

    def prepare(environment: object, **kwargs: object) -> object:
        calls.append(("prepare", (environment, kwargs)))
        return prepared

    def write(packet: object, **kwargs: object) -> None:
        calls.append(("write", (packet, kwargs)))

    dependencies = module.GeneratorDependencies(
        prepare_master_authorization=prepare,
        write_prepared_authorization=write,
    )
    environment = {"CYBRIK_UAT_SUITE_ROOT": "/repos/suite"}

    result = module.main(
        _valid_argv(tmp_path), environment=environment, dependencies=dependencies
    )

    assert result == 0
    assert [name for name, _value in calls] == ["prepare", "write"]
    prepare_environment, prepare_kwargs = calls[0][1]
    assert prepare_environment is environment
    assert prepare_kwargs == {
        "authorization_id": "master-uat-20260803-001",
        "authorized_by": "FOUNDER",
        "issued_at": datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
        "expires_at": datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
    }
    written_packet, write_kwargs = calls[1][1]
    assert written_packet is prepared
    assert write_kwargs == {
        "payload_path": tmp_path / "master-authorization.json",
        "receipt_path": tmp_path / "preparation-receipt.json",
    }
    response = json.loads(capsys.readouterr().out)
    assert response == {
        "authorization_payload": str(tmp_path / "master-authorization.json"),
        "preparation_receipt": str(tmp_path / "preparation-receipt.json"),
        "status": "PREPARED_UNSIGNED",
    }


def test_emit_has_no_private_key_or_signature_surface(tmp_path: Path) -> None:
    _load_script()
    parser_contract = SCRIPT.read_text(encoding="utf-8").lower()

    assert "--private-key" not in parser_contract
    assert "--signature-output" not in parser_contract
    assert "ssh-keygen" not in parser_contract
    assert "subprocess" not in parser_contract

    argv = _valid_argv(tmp_path)
    assert all("secret" not in value.lower() for value in argv)
