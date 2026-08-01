"""Fail-closed tests for the D2-COV-P0 authorization validator."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import stat
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "scripts" / "validate_coverage_authorization.py"
SPEC = importlib.util.spec_from_file_location("validate_coverage_authorization", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
authorization = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = authorization
SPEC.loader.exec_module(authorization)


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _fields(tmp_path: Path) -> dict[str, str]:
    suite_root = tmp_path / "suite"
    python_root = tmp_path / "d1-closure"
    evidence_parent = tmp_path / "evidence-parent"
    tool_parent = tmp_path / "tool-parent"
    for path in (suite_root, python_root / "bin", evidence_parent, tool_parent):
        path.mkdir(parents=True, mode=0o700)
        path.chmod(0o700)

    python_realpath = python_root / "bin" / "python3.12"
    python_realpath.write_bytes(b"pinned-python")
    python_realpath.chmod(0o700)
    python_link = python_root / "bin" / "python"
    python_link.symlink_to("python3.12")

    now = datetime(2026, 8, 2, 4, 0, tzinfo=UTC)
    values = {
        "D2_COV_P0": "APPROVE",
        "AUTHORIZATION_ID": "d2-cov-p0-20260802-001",
        "AUTHORIZED_BY": "FOUNDER",
        "AUTHORIZED_AT": now.isoformat(),
        "AUTHORIZATION_EXPIRES_AT": (now + timedelta(hours=1)).isoformat(),
        "SUITE_COMMIT": "a" * 40,
        "SUITE_TREE": "b" * 40,
        "SUITE_ROOT": str(suite_root),
        "HEAD_MODE": "detached",
        "WORKING_DIRECTORY": str(suite_root),
        "HOST_TEMP_ROOT": "/private/var/folders/aa/test/T",
        "COVERAGE_ROOT": str(tool_parent / "cybrik-uat-d2-coverage-r1"),
        "COVERAGE_EVIDENCE_ROOT": str(
            evidence_parent / "cybrik-uat-d2-coverage-evidence-r1"
        ),
        "PINNED_PYTHON": str(python_link),
        "PINNED_PYTHON_REALPATH": str(python_realpath),
        "PINNED_PYTHON_SHA256": "a395f264e5612a2819662ed3e37fd30d39ed61179b98e5f86c3c783a008d8623",
        "PYTHON_VERSION": "3.12.13",
        "PYTEST_VERSION": "9.1.1",
        "CRYPTOGRAPHY_VERSION": "50.0.0",
        "D1_LOCK_SHA256": "e05c5e281e230b2089e356d716212a6d2c2e4320a3a30dc8dfd126216faa3add",
        "D1_REQUIREMENTS_SHA256": "93ec6936e7999ee68e04434b563581ccc5a2e3b4010e252554048b7f75bf1603",
        "D1_LOCKED_WHEEL_COUNT": "56",
        "PINNED_CLOSURE_SHA256": authorization.PINNED_VALUES["PINNED_CLOSURE_SHA256"],
        "WHEEL_FILENAME": "coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl",
        "WHEEL_URL": "https://files.pythonhosted.org/packages/06/d1/da99af464c335d4e023a6efcd7ec30f63b88a43c93745154ab74ffb31cea/coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl",
        "WHEEL_SIZE": "221943",
        "WHEEL_SHA256": "b868acc62aa5de3be7a9d05c2333bf8359ca987e43f9cb30ff8fbda6a024ab73",
        "OSV_ENDPOINT": "https://api.osv.dev/v1/query",
        "OSV_REQUEST_SHA256": "c01011168771934d729261c649c71dadc0d47300cd698c64763cad12a4b7bec7",
        "NETWORK_CLIENT": "/usr/bin/curl",
        "NETWORK_CLIENT_REALPATH": "/usr/bin/curl",
        "NETWORK_CLIENT_SHA256": "5ab042572ea0e068644e3b8f9e8dd1ad197bfcf33d199316615b46ddc4390a41",
        "NETWORK_CLIENT_VERSION": "curl 8.7.1 (x86_64-apple-darwin25.0) libcurl/8.7.1 (SecureTransport) LibreSSL/3.3.6 zlib/1.2.12 nghttp2/1.68.1",
        "NETWORK_POLICY": "wheel-url-and-one-osv-post-only-no-other-network",
        "FETCH_COMMAND": "/usr/bin/curl --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --noproxy '*' --connect-timeout 10 --max-time 60 --output <COVERAGE_ROOT>/wheel/<WHEEL_FILENAME> <WHEEL_URL>",
        "OSV_REQUEST_COMMAND": "/usr/bin/curl --fail-with-body --silent --show-error --proto '=https' --tlsv1.2 --noproxy '*' --connect-timeout 10 --max-time 60 --request POST --header 'Content-Type: application/json' --data-binary @<COVERAGE_EVIDENCE_ROOT>/osv-request.json --output <COVERAGE_EVIDENCE_ROOT>/osv-response.json --write-out '%{http_code}' <OSV_ENDPOINT>",
        "EXTRACTION_COMMAND": "<PINNED_PYTHON> -m zipfile -e <COVERAGE_ROOT>/wheel/coverage-7.15.2-cp312-cp312-macosx_11_0_arm64.whl <COVERAGE_ROOT>/site-packages",
        "AUTHORIZED_TOOL_SUBPATHS": "wheel,site-packages,data",
        "ONE_SHOT": "true",
        "ROLLBACK": "remove-only-COVERAGE_ROOT-after-failure-record-preserve-COVERAGE_EVIDENCE_ROOT",
    }
    assert tuple(values) == authorization.EXPECTED_FIELDS
    return values


def _text(fields: dict[str, str]) -> str:
    return "".join(f"{key}={value}\n" for key, value in fields.items())


def _observed(fields: dict[str, str]) -> object:
    return authorization.ObservedState(
        now=datetime(2026, 8, 2, 4, 30, tzinfo=UTC),
        suite_commit=fields["SUITE_COMMIT"],
        suite_tree=fields["SUITE_TREE"],
        suite_root=Path(fields["SUITE_ROOT"]),
        working_directory=Path(fields["WORKING_DIRECTORY"]),
        head_mode="detached",
        git_status="",
        host_temp_root=Path(fields["HOST_TEMP_ROOT"]),
        python_realpath=Path(fields["PINNED_PYTHON_REALPATH"]),
        python_sha256=fields["PINNED_PYTHON_SHA256"],
        python_version="3.12.13",
        pytest_version="9.1.1",
        cryptography_version="50.0.0",
        closure_sha256=fields["PINNED_CLOSURE_SHA256"],
        locked_wheel_count=56,
        d1_lock_sha256=fields["D1_LOCK_SHA256"],
        d1_requirements_sha256=fields["D1_REQUIREMENTS_SHA256"],
        network_client_realpath=Path(fields["NETWORK_CLIENT_REALPATH"]),
        network_client_sha256=fields["NETWORK_CLIENT_SHA256"],
        network_client_version=fields["NETWORK_CLIENT_VERSION"],
    )


def test_parser_requires_the_exact_ordered_field_set(tmp_path: Path) -> None:
    fields = _fields(tmp_path)
    assert authorization.parse_authorization(_text(fields)) == fields

    missing = dict(fields)
    missing.pop("PINNED_CLOSURE_SHA256")
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.parse_authorization(_text(missing))
    assert error.value.reason == "authorization_fields_invalid"

    duplicate = _text(fields) + "D2_COV_P0=APPROVE\n"
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.parse_authorization(duplicate)
    assert error.value.reason == "authorization_fields_invalid"


def test_closure_digest_is_stable_and_order_independent() -> None:
    first = [("pytest", "9.1.1"), ("cryptography", "50.0.0")]
    second = list(reversed(first))
    assert authorization.closure_digest(first) == authorization.closure_digest(second)
    assert authorization.closure_digest(first) == _sha256(
        b"cryptography==50.0.0\npytest==9.1.1\n"
    )


def test_accepted_coverage_closure_is_pinned_to_d1_sbom_without_anycorn() -> None:
    sbom = json.loads(
        (Path(__file__).parents[1] / "evidence" / "sbom.cdx.json").read_text(
            encoding="utf-8"
        )
    )
    rows = [
        (component["name"], component["version"])
        for component in sbom["components"]
        if component["name"].lower() != "anycorn"
    ]
    assert len(rows) == 56
    assert (
        authorization.closure_digest(rows)
        == authorization.PINNED_VALUES["PINNED_CLOSURE_SHA256"]
    )


def test_d1_requirement_and_wheel_pins_are_bound_to_committed_evidence() -> None:
    requirements_sha256, wheel_count = authorization._d1_evidence_observation(
        Path(__file__).parents[4]
    )
    assert requirements_sha256 == authorization.PINNED_VALUES["D1_REQUIREMENTS_SHA256"]
    assert wheel_count == int(authorization.PINNED_VALUES["D1_LOCKED_WHEEL_COUNT"])


def test_authorization_reader_rejects_symlinks_and_oversized_files(
    tmp_path: Path,
) -> None:
    target = tmp_path / "authorization.env"
    target.write_bytes(b"safe\n")
    target.chmod(0o600)
    link = tmp_path / "authorization-link.env"
    link.symlink_to(target)
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization._read_authorization(link)
    assert error.value.reason == "authorization_artifact_invalid"

    oversized = tmp_path / "authorization-oversized.env"
    oversized.write_bytes(b"x" * (authorization.MAX_AUTHORIZATION_BYTES + 1))
    oversized.chmod(0o600)
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization._read_authorization(oversized)
    assert error.value.reason == "authorization_artifact_invalid"


@pytest.mark.parametrize(
    ("change", "reason"),
    [
        ({"head_mode": "attached"}, "suite_state_mismatch"),
        ({"git_status": "?? residue"}, "suite_state_mismatch"),
        ({"network_client_sha256": "0" * 64}, "network_client_identity_mismatch"),
    ],
)
def test_validation_fail_closes_on_checkout_and_client_drift(
    tmp_path: Path, change: dict[str, object], reason: str
) -> None:
    fields = _fields(tmp_path)
    observed = authorization.ObservedState(**{**_observed(fields).__dict__, **change})
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.validate_authorization(fields, observed)
    assert error.value.reason == reason


def test_validation_rejects_unsafe_root_parent_and_repository_overlap(
    tmp_path: Path,
) -> None:
    fields = _fields(tmp_path)
    unsafe_parent = Path(fields["COVERAGE_ROOT"]).parent
    unsafe_parent.chmod(0o770)
    try:
        with pytest.raises(authorization.AuthorizationFailure) as error:
            authorization.validate_authorization(fields, _observed(fields))
        assert error.value.reason == "authorization_root_parent_unsafe"
    finally:
        unsafe_parent.chmod(0o700)

    fields = _fields(tmp_path / "overlap")
    fields["COVERAGE_ROOT"] = str(
        Path(fields["SUITE_ROOT"]) / "cybrik-uat-d2-coverage-overlap"
    )
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.validate_authorization(fields, _observed(fields))
    assert error.value.reason == "authorization_root_overlap"


def test_validation_rejects_the_superseded_cryptography_closure(tmp_path: Path) -> None:
    fields = _fields(tmp_path)
    observed = _observed(fields)
    observed = authorization.ObservedState(
        **{**observed.__dict__, "cryptography_version": "46.0.7"}
    )
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.validate_authorization(fields, observed)
    assert error.value.reason == "cryptography_version_mismatch"


def test_validation_rejects_a_temp_root_interpreter(tmp_path: Path) -> None:
    fields = _fields(tmp_path)
    fields["PINNED_PYTHON"] = "/private/tmp/d1/bin/python"
    fields["PINNED_PYTHON_REALPATH"] = "/private/tmp/d1/bin/python3.12"
    observed = _observed(fields)
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.validate_authorization(fields, observed)
    assert error.value.reason == "pinned_python_under_host_temp"


def test_validation_rejects_a_real_executable_under_host_temp(tmp_path: Path) -> None:
    fields = _fields(tmp_path)
    host_temp = tmp_path / "host-temp"
    host_temp.mkdir(mode=0o700)
    temp_executable = host_temp / "python3.12"
    temp_executable.write_bytes(b"pinned-python")
    temp_executable.chmod(0o700)
    intermediate = Path(fields["PINNED_PYTHON"]).with_name("python3.12")
    intermediate.unlink()
    intermediate.symlink_to(temp_executable)
    fields["HOST_TEMP_ROOT"] = str(host_temp)
    fields["PINNED_PYTHON_REALPATH"] = str(temp_executable)
    observed = authorization.ObservedState(
        **{
            **_observed(fields).__dict__,
            "host_temp_root": host_temp,
            "python_realpath": temp_executable,
        }
    )

    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.validate_authorization(fields, observed)
    assert error.value.reason == "pinned_python_under_host_temp"


def test_validation_rejects_an_operator_selected_closure_digest(tmp_path: Path) -> None:
    fields = _fields(tmp_path)
    fields["PINNED_CLOSURE_SHA256"] = "d" * 64
    observed = authorization.ObservedState(
        **{
            **_observed(fields).__dict__,
            "closure_sha256": fields["PINNED_CLOSURE_SHA256"],
        }
    )

    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.validate_authorization(fields, observed)
    assert error.value.reason == "authorization_pinned_value_mismatch"


def test_validation_rejects_expired_or_overwide_authority(tmp_path: Path) -> None:
    fields = _fields(tmp_path)
    observed = _observed(fields)
    fields["AUTHORIZATION_EXPIRES_AT"] = (
        observed.now + timedelta(hours=25)
    ).isoformat()
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.validate_authorization(fields, observed)
    assert error.value.reason == "authorization_window_invalid"

    fields = _fields(tmp_path / "expired")
    observed = authorization.ObservedState(
        **{**_observed(fields).__dict__, "now": datetime(2026, 8, 3, tzinfo=UTC)}
    )
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.validate_authorization(fields, observed)
    assert error.value.reason == "authorization_not_current"


def test_consume_creates_exact_roots_and_cannot_be_replayed(tmp_path: Path) -> None:
    fields = _fields(tmp_path)
    raw = _text(fields).encode()
    observed = _observed(fields)
    resolved = authorization.validate_authorization(fields, observed)

    record = authorization.consume_authorization(resolved, raw)
    tool_root = Path(fields["COVERAGE_ROOT"])
    evidence_root = Path(fields["COVERAGE_EVIDENCE_ROOT"])
    assert stat.S_IMODE(tool_root.stat().st_mode) == 0o700
    assert stat.S_IMODE(evidence_root.stat().st_mode) == 0o700
    assert (evidence_root / "authorization.env").read_bytes() == raw
    assert (
        json.loads((evidence_root / "authorization-consumption.json").read_text())[
            "authorization_id"
        ]
        == fields["AUTHORIZATION_ID"]
    )
    assert record["authorization_id"] == fields["AUTHORIZATION_ID"]

    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.consume_authorization(resolved, raw)
    assert error.value.reason == "authorization_root_not_fresh"


def test_invalid_authorization_performs_no_filesystem_action(tmp_path: Path) -> None:
    fields = _fields(tmp_path)
    fields["PINNED_CLOSURE_SHA256"] = "d" * 64
    with pytest.raises(authorization.AuthorizationFailure):
        authorization.validate_authorization(
            fields, _observed(_fields(tmp_path / "other"))
        )
    assert not Path(fields["COVERAGE_ROOT"]).exists()
    assert not Path(fields["COVERAGE_EVIDENCE_ROOT"]).exists()


def test_observation_refuses_unvalidated_executable_before_subprocess(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fields = _fields(tmp_path)
    fields["PINNED_PYTHON"] = "/bin/echo"
    fields["PINNED_PYTHON_REALPATH"] = "/bin/echo"

    def unexpected_run(*args: object, **kwargs: object) -> str:
        pytest.fail(
            f"subprocess reached before authorization validation: {args!r} {kwargs!r}"
        )

    monkeypatch.setattr(authorization, "_run", unexpected_run)
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.collect_observed(fields)
    assert error.value.reason == "observation_input_invalid"


def test_consume_anchors_every_creation_to_verified_directory_descriptors(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fields = _fields(tmp_path)
    raw = _text(fields).encode()
    resolved = authorization.validate_authorization(fields, _observed(fields))
    original_mkdir = authorization.os.mkdir
    observed_calls: list[tuple[object, int | None]] = []

    def anchored_mkdir(
        path: object, mode: int = 0o777, *, dir_fd: int | None = None
    ) -> None:
        observed_calls.append((path, dir_fd))
        original_mkdir(path, mode, dir_fd=dir_fd)

    monkeypatch.setattr(authorization.os, "mkdir", anchored_mkdir)
    authorization.consume_authorization(resolved, raw)

    assert len(observed_calls) == 5
    assert all(dir_fd is not None for _, dir_fd in observed_calls)
    assert [str(path) for path, _ in observed_calls] == [
        Path(fields["COVERAGE_EVIDENCE_ROOT"]).name,
        Path(fields["COVERAGE_ROOT"]).name,
        "wheel",
        "site-packages",
        "data",
    ]


def test_consume_preserves_failure_evidence_when_tool_root_creation_races(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fields = _fields(tmp_path)
    raw = _text(fields).encode()
    resolved = authorization.validate_authorization(fields, _observed(fields))
    original_mkdir = authorization.os.mkdir
    tool_name = Path(fields["COVERAGE_ROOT"]).name

    def racing_mkdir(
        path: object, mode: int = 0o777, *, dir_fd: int | None = None
    ) -> None:
        if str(path) == tool_name:
            raise FileExistsError(tool_name)
        original_mkdir(path, mode, dir_fd=dir_fd)

    monkeypatch.setattr(authorization.os, "mkdir", racing_mkdir)
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.consume_authorization(resolved, raw)

    assert error.value.reason == "authorization_root_not_fresh"
    evidence_root = Path(fields["COVERAGE_EVIDENCE_ROOT"])
    assert json.loads((evidence_root / "authorization-failure.json").read_text()) == {
        "reason": "authorization_root_not_fresh",
        "status": "failed_pre_network",
    }
    assert not Path(fields["COVERAGE_ROOT"]).exists()


def test_consume_rejects_parent_rebinding_before_first_mkdir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fields = _fields(tmp_path)
    raw = _text(fields).encode()
    resolved = authorization.validate_authorization(fields, _observed(fields))
    evidence_parent = Path(fields["COVERAGE_EVIDENCE_ROOT"]).parent
    moved_parent = evidence_parent.with_name("evidence-parent-moved")
    replacement = tmp_path / "replacement"
    replacement.mkdir(mode=0o700)
    original_open = authorization._open_verified_directory
    call_count = 0

    def open_then_rebind(path: Path) -> int:
        nonlocal call_count
        descriptor = original_open(path)
        call_count += 1
        if call_count == 1:
            evidence_parent.rename(moved_parent)
            evidence_parent.symlink_to(replacement, target_is_directory=True)
        return descriptor

    monkeypatch.setattr(authorization, "_open_verified_directory", open_then_rebind)
    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.consume_authorization(resolved, raw)

    assert error.value.reason == "authorization_consumption_failed"
    assert not (replacement / Path(fields["COVERAGE_EVIDENCE_ROOT"]).name).exists()
    assert not (moved_parent / Path(fields["COVERAGE_EVIDENCE_ROOT"]).name).exists()


def test_consume_rejects_parent_rebinding_before_parent_fd_open(
    tmp_path: Path,
) -> None:
    fields = _fields(tmp_path)
    raw = _text(fields).encode()
    resolved = authorization.validate_authorization(fields, _observed(fields))
    evidence_parent = Path(fields["COVERAGE_EVIDENCE_ROOT"]).parent
    moved_parent = evidence_parent.with_name("evidence-parent-preopen-moved")
    evidence_parent.rename(moved_parent)
    evidence_parent.mkdir(mode=0o700)

    with pytest.raises(authorization.AuthorizationFailure) as error:
        authorization.consume_authorization(resolved, raw)

    assert error.value.reason == "authorization_consumption_failed"
    assert not (evidence_parent / Path(fields["COVERAGE_EVIDENCE_ROOT"]).name).exists()
    assert not (moved_parent / Path(fields["COVERAGE_EVIDENCE_ROOT"]).name).exists()
