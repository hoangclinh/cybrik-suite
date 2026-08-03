from __future__ import annotations

import hashlib
import json
import os
import stat
from dataclasses import FrozenInstanceError
from datetime import UTC, datetime
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest


def _implementation() -> ModuleType:
    try:
        from cybrik_suite_integrated_uat import preparation
    except (ImportError, ModuleNotFoundError) as exc:
        pytest.fail(
            "missing implementation: cybrik_suite_integrated_uat.preparation",
            pytrace=False,
        )
        raise AssertionError from exc
    return preparation


def _private_root(path: Path) -> Path:
    path.mkdir()
    path.chmod(0o700)
    return path.resolve()


def _environment(
    tmp_path: Path,
) -> tuple[dict[str, str], tuple[Path, ...], tuple[Path, ...]]:
    tmp_path.mkdir(parents=True, exist_ok=True)
    repositories = tuple(
        _private_root(tmp_path / name) for name in ("suite", "soc", "ai", "fabric")
    )
    private_roots = tuple(
        _private_root(tmp_path / name)
        for name in (
            "master-evidence",
            "cybrik-uat-d2-runtime-packet-1",
            "cybrik-uat-d2-evidence-packet-1",
            "alert-runtime",
            "alert-evidence",
            "alert-state",
        )
    )
    wheel = tmp_path / "anycorn-0.20.0+cybrik.1-py3-none-any.whl"
    python = tmp_path / "python"
    wheel.write_bytes(b"reviewed-wheel")
    python.write_bytes(b"reviewed-python")
    wheel.chmod(0o600)
    python.chmod(0o700)
    environment = {
        "CYBRIK_UAT_SUITE_ROOT": str(repositories[0]),
        "CYBRIK_UAT_SOC_ROOT": str(repositories[1]),
        "CYBRIK_UAT_CYBER_AI_ROOT": str(repositories[2]),
        "CYBRIK_UAT_TOOL_FABRIC_ROOT": str(repositories[3]),
        "CYBRIK_UAT_MASTER_EVIDENCE_ROOT": str(private_roots[0]),
        "CYBRIK_UAT_D2_RUNTIME_DIR": str(private_roots[1]),
        "CYBRIK_UAT_D2_EVIDENCE_DIR": str(private_roots[2]),
        "CYBRIK_UAT_RUNTIME_ROOT": str(private_roots[3]),
        "CYBRIK_UAT_EVIDENCE_ROOT": str(private_roots[4]),
        "CYBRIK_UAT_STATE_ROOT": str(private_roots[5]),
        "CYBRIK_UAT_B1_WHEEL": str(wheel.resolve()),
        "CYBRIK_UAT_PYTHON": str(python.resolve()),
    }
    return environment, repositories, private_roots


def _observations(
    repositories: tuple[Path, ...], *, suffix: str = ""
) -> tuple[object, ...]:
    return tuple(
        SimpleNamespace(
            role=role,
            root=root,
            commit=(character * 39) + (suffix or character),
            tree=tree_character * 40,
            clean=True,
        )
        for role, root, character, tree_character in zip(
            ("suite", "soc", "cyber_ai", "tool_fabric"),
            repositories,
            ("a", "b", "c", "d"),
            ("1", "2", "3", "4"),
            strict=True,
        )
    )


def _dependencies(
    repositories: tuple[Path, ...],
    *,
    observation_batches: list[tuple[object, ...]] | None = None,
) -> tuple[object, dict[str, int]]:
    module = _implementation()
    batches = list(observation_batches or [_observations(repositories)] * 2)
    calls = {"observe": 0, "aggregate": 0, "helper": 0, "pinned": 0}

    def observe(expectations: object) -> tuple[object, ...]:
        assert tuple(item.role for item in expectations) == (
            "suite",
            "soc",
            "cyber_ai",
            "tool_fabric",
        )
        calls["observe"] += 1
        return batches.pop(0)

    def aggregate(observations: object, allowlist: object) -> object:
        assert tuple(item.role for item in observations) == (
            "suite",
            "soc",
            "cyber_ai",
            "tool_fabric",
        )
        assert allowlist
        calls["aggregate"] += 1
        return SimpleNamespace(
            algorithm="cybrik-uat-tracked-blob-sha256-lines/v1",
            file_count=sum(len(paths) for paths in allowlist.values()),
            sha256="e" * 64,
        )

    def helper_sha256(suite_root: Path, relative: Path) -> str:
        assert suite_root == repositories[0]
        calls["helper"] += 1
        return hashlib.sha256(relative.as_posix().encode()).hexdigest()

    def pinned_file_sha256(path: Path) -> str:
        calls["pinned"] += 1
        return hashlib.sha256(path.read_bytes()).hexdigest()

    dependencies = module.PreparationDependencies(
        helper_sha256=helper_sha256,
        observe_exact_tuple=observe,
        pinned_file_sha256=pinned_file_sha256,
        tracked_blob_aggregate=aggregate,
    )
    return dependencies, calls


def _prepare(
    tmp_path: Path,
    *,
    environment_change: tuple[str, str] | None = None,
    observation_batches: list[tuple[object, ...]] | None = None,
) -> tuple[object, dict[str, int], dict[str, str], tuple[Path, ...], tuple[Path, ...]]:
    module = _implementation()
    environment, repositories, private_roots = _environment(tmp_path)
    if environment_change is not None:
        environment[environment_change[0]] = environment_change[1]
    dependencies, calls = _dependencies(
        repositories, observation_batches=observation_batches
    )
    prepared = module.prepare_master_authorization(
        environment,
        authorization_id="master-uat-20260803-001",
        authorized_by="FOUNDER",
        issued_at=datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
        expires_at=datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
        dependencies=dependencies,
    )
    return prepared, calls, environment, repositories, private_roots


def test_preparation_collects_twice_and_builds_verifier_identical_bytes(
    tmp_path: Path,
) -> None:
    from cybrik_suite_integrated_uat import admission

    try:
        from cybrik_suite_integrated_uat import authorization_packet as packet_module
    except (ImportError, ModuleNotFoundError) as exc:
        pytest.fail(
            "missing implementation: cybrik_suite_integrated_uat.authorization_packet",
            pytrace=False,
        )
        raise AssertionError from exc
    prepared, calls, *_ = _prepare(tmp_path)

    assert calls == {"observe": 2, "aggregate": 1, "helper": 4, "pinned": 2}
    assert prepared.payload == packet_module.canonical_master_payload(prepared.bindings)
    assert admission._master_record(prepared.payload) == json.loads(prepared.payload)
    assert not prepared.payload.endswith(b"\n")
    assert json.loads(prepared.payload)["authorization_id"] == "master-uat-20260803-001"


def test_prepared_packet_and_receipt_are_frozen(tmp_path: Path) -> None:
    prepared, *_ = _prepare(tmp_path)

    with pytest.raises(FrozenInstanceError):
        prepared.payload = b"changed"


def test_receipt_contains_non_secret_signing_argv_template(tmp_path: Path) -> None:
    prepared, *_ = _prepare(tmp_path)
    receipt = json.loads(prepared.receipt)
    serialized = prepared.receipt.decode("utf-8").lower()

    assert receipt["schema"] == "CYBRIK-INTEGRATED-UAT-PREPARATION-RECEIPT/v1"
    assert receipt["payload_sha256"] == hashlib.sha256(prepared.payload).hexdigest()
    assert isinstance(receipt["signing_argv_template"], list)
    assert "<PRIVATE_KEY_PATH>" in receipt["signing_argv_template"]
    assert "<AUTHORIZATION_PAYLOAD_PATH>" in receipt["signing_argv_template"]
    assert "private_key_data" not in serialized
    assert "signature_data" not in serialized
    assert "begin openssh private key" not in serialized


def test_unknown_cybrik_uat_environment_name_fails_closed(tmp_path: Path) -> None:
    module = _implementation()
    environment, repositories, _private_roots = _environment(tmp_path)
    environment["CYBRIK_UAT_UNREVIEWED_ESCAPE"] = "1"
    dependencies, _calls = _dependencies(repositories)

    with pytest.raises(module.PreparationError, match="environment_unknown"):
        module.prepare_master_authorization(
            environment,
            authorization_id="master-uat-20260803-001",
            authorized_by="FOUNDER",
            issued_at=datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
            expires_at=datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
            dependencies=dependencies,
        )


@pytest.mark.parametrize(
    ("field", "value", "reason"),
    (
        ("authorization_id", "master_underscore", "authorization_id_invalid"),
        ("authorized_by", "CODEX_GOVERNOR", "authorized_signer_invalid"),
    ),
)
def test_master_policy_values_are_rejected_before_observation(
    tmp_path: Path, field: str, value: str, reason: str
) -> None:
    module = _implementation()
    environment, repositories, _private_roots = _environment(tmp_path)
    dependencies, calls = _dependencies(repositories)
    arguments = {
        "authorization_id": "master-uat-20260803-001",
        "authorized_by": "FOUNDER",
        "issued_at": datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
        "expires_at": datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
        "dependencies": dependencies,
    }
    arguments[field] = value

    with pytest.raises(module.PreparationError, match=reason):
        module.prepare_master_authorization(environment, **arguments)

    assert calls["observe"] == 0


@pytest.mark.parametrize(
    ("target", "mode"),
    (("wheel", 0o644), ("python", 0o600)),
)
def test_pinned_files_require_runtime_compatible_modes(
    tmp_path: Path, target: str, mode: int
) -> None:
    module = _implementation()
    environment, repositories, _private_roots = _environment(tmp_path)
    Path(
        environment[f"CYBRIK_UAT_{'B1_WHEEL' if target == 'wheel' else 'PYTHON'}"]
    ).chmod(mode)
    dependencies, calls = _dependencies(repositories)

    with pytest.raises(module.PreparationError, match="pinned_file_invalid"):
        module.prepare_master_authorization(
            environment,
            authorization_id="master-uat-20260803-001",
            authorized_by="FOUNDER",
            issued_at=datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
            expires_at=datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
            dependencies=dependencies,
        )

    assert calls["pinned"] == 0


def test_b1_wheel_requires_exact_reviewed_filename(tmp_path: Path) -> None:
    module = _implementation()
    environment, repositories, _private_roots = _environment(tmp_path)
    original = Path(environment["CYBRIK_UAT_B1_WHEEL"])
    wrong = original.with_name("renamed-reviewed-bytes.whl")
    original.rename(wrong)
    environment["CYBRIK_UAT_B1_WHEEL"] = str(wrong)
    dependencies, calls = _dependencies(repositories)

    with pytest.raises(module.PreparationError, match="pinned_file_invalid"):
        module.prepare_master_authorization(
            environment,
            authorization_id="master-uat-20260803-001",
            authorized_by="FOUNDER",
            issued_at=datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
            expires_at=datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
            dependencies=dependencies,
        )

    assert calls["pinned"] == 0


def test_runtime_trust_preflight_binds_namespace_and_exact_pins(tmp_path: Path) -> None:
    module = _implementation()
    environment, repositories, _private_roots = _environment(tmp_path)
    base, calls = _dependencies(repositories)
    observed: list[tuple[object, ...]] = []

    def validate_runtime_inputs(*arguments: object) -> str:
        observed.append(arguments)
        return "reviewed-test-namespace"

    dependencies = module.PreparationDependencies(
        helper_sha256=base.helper_sha256,
        observe_exact_tuple=base.observe_exact_tuple,
        pinned_file_sha256=base.pinned_file_sha256,
        tracked_blob_aggregate=base.tracked_blob_aggregate,
        validate_runtime_inputs=validate_runtime_inputs,
    )

    prepared = module.prepare_master_authorization(
        environment,
        authorization_id="master-uat-20260803-001",
        authorized_by="FOUNDER",
        issued_at=datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
        expires_at=datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
        dependencies=dependencies,
    )

    assert len(observed) == 1
    assert observed[0][0] is environment
    assert observed[0][1] == repositories[0]
    assert observed[0][2] == Path(environment["CYBRIK_UAT_B1_WHEEL"])
    assert observed[0][4] == Path(environment["CYBRIK_UAT_PYTHON"])
    assert observed[0][6] == "FOUNDER"
    assert (
        "reviewed-test-namespace"
        in json.loads(prepared.receipt)["signing_argv_template"]
    )
    assert calls["observe"] == 2


def test_dirty_repository_observation_fails_before_packet_emission(
    tmp_path: Path,
) -> None:
    module = _implementation()
    environment, repositories, _private_roots = _environment(tmp_path)
    dirty = list(_observations(repositories))
    dirty[1] = SimpleNamespace(**{**vars(dirty[1]), "clean": False})
    dependencies, calls = _dependencies(
        repositories, observation_batches=[tuple(dirty), tuple(dirty)]
    )

    with pytest.raises(module.PreparationError, match="repository_not_clean"):
        module.prepare_master_authorization(
            environment,
            authorization_id="master-uat-20260803-001",
            authorized_by="FOUNDER",
            issued_at=datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
            expires_at=datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
            dependencies=dependencies,
        )

    assert calls["aggregate"] == 0


def test_repository_symlink_fails_before_observation(tmp_path: Path) -> None:
    module = _implementation()
    environment, repositories, _private_roots = _environment(tmp_path)
    linked = tmp_path / "suite-link"
    linked.symlink_to(repositories[0], target_is_directory=True)
    environment["CYBRIK_UAT_SUITE_ROOT"] = str(linked)
    dependencies, calls = _dependencies(repositories)

    with pytest.raises(module.PreparationError, match="repository_root_invalid"):
        module.prepare_master_authorization(
            environment,
            authorization_id="master-uat-20260803-001",
            authorized_by="FOUNDER",
            issued_at=datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
            expires_at=datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
            dependencies=dependencies,
        )

    assert calls["observe"] == 0


def test_repository_change_between_observations_is_toctou_failure(
    tmp_path: Path,
) -> None:
    module = _implementation()
    environment, repositories, _private_roots = _environment(tmp_path)
    first = _observations(repositories)
    changed = list(first)
    changed[0] = SimpleNamespace(**{**vars(changed[0]), "commit": "f" * 40})
    dependencies, calls = _dependencies(
        repositories, observation_batches=[first, tuple(changed)]
    )

    with pytest.raises(module.PreparationError, match="repository_changed"):
        module.prepare_master_authorization(
            environment,
            authorization_id="master-uat-20260803-001",
            authorized_by="FOUNDER",
            issued_at=datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
            expires_at=datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
            dependencies=dependencies,
        )

    assert calls["observe"] == 2


def test_repository_and_private_root_overlap_fails_closed(tmp_path: Path) -> None:
    module = _implementation()
    environment, repositories, _private_roots = _environment(tmp_path)
    environment["CYBRIK_UAT_MASTER_EVIDENCE_ROOT"] = str(repositories[0])
    dependencies, calls = _dependencies(repositories)

    with pytest.raises(module.PreparationError, match="roots_not_disjoint"):
        module.prepare_master_authorization(
            environment,
            authorization_id="master-uat-20260803-001",
            authorized_by="FOUNDER",
            issued_at=datetime(2026, 8, 3, 0, 0, tzinfo=UTC),
            expires_at=datetime(2026, 8, 3, 1, 0, tzinfo=UTC),
            dependencies=dependencies,
        )

    assert calls["observe"] == 0


def test_secure_writer_creates_two_exclusive_private_files(tmp_path: Path) -> None:
    module = _implementation()
    prepared, *_ = _prepare(tmp_path / "inputs")
    output = _private_root(tmp_path / "operator")
    payload_path = output / "master-authorization.json"
    receipt_path = output / "preparation-receipt.json"

    module.write_prepared_authorization(
        prepared, payload_path=payload_path, receipt_path=receipt_path
    )

    assert payload_path.read_bytes() == prepared.payload
    assert receipt_path.read_bytes() == prepared.receipt
    assert stat.S_IMODE(payload_path.stat().st_mode) == 0o600
    assert stat.S_IMODE(receipt_path.stat().st_mode) == 0o600
    assert payload_path.stat().st_nlink == 1
    assert receipt_path.stat().st_nlink == 1


@pytest.mark.parametrize("kind", ("existing", "symlink"))
def test_secure_writer_never_replaces_existing_or_symlink_output(
    tmp_path: Path, kind: str
) -> None:
    module = _implementation()
    prepared, *_ = _prepare(tmp_path / "inputs")
    output = _private_root(tmp_path / "operator")
    payload_path = output / "master-authorization.json"
    receipt_path = output / "preparation-receipt.json"
    protected = tmp_path / "protected"
    protected.write_bytes(b"do-not-touch")
    if kind == "existing":
        payload_path.write_bytes(b"do-not-replace")
    else:
        payload_path.symlink_to(protected)

    with pytest.raises(module.PreparationError, match="output_invalid"):
        module.write_prepared_authorization(
            prepared, payload_path=payload_path, receipt_path=receipt_path
        )

    assert protected.read_bytes() == b"do-not-touch"
    if kind == "existing":
        assert payload_path.read_bytes() == b"do-not-replace"
    assert not receipt_path.exists()


def test_secure_writer_rejects_output_inside_repository_or_private_root(
    tmp_path: Path,
) -> None:
    module = _implementation()
    prepared, _calls, _environment_map, repositories, private_roots = _prepare(
        tmp_path / "inputs"
    )

    for index, forbidden_root in enumerate((*repositories, *private_roots)):
        outside_payload = tmp_path / f"authorization-{index}.json"
        outside_receipt = tmp_path / f"receipt-{index}.json"
        for payload_path, receipt_path in (
            (forbidden_root / "authorization.json", outside_receipt),
            (outside_payload, forbidden_root / "receipt.json"),
        ):
            with pytest.raises(
                module.PreparationError, match="output_overlaps_protected_root"
            ):
                module.write_prepared_authorization(
                    prepared,
                    payload_path=payload_path,
                    receipt_path=receipt_path,
                )
            assert not outside_payload.exists()
            assert not outside_receipt.exists()


def test_secure_writer_rejects_same_payload_and_receipt_path(tmp_path: Path) -> None:
    module = _implementation()
    prepared, *_ = _prepare(tmp_path / "inputs")
    output = _private_root(tmp_path / "operator") / "one-file.json"

    with pytest.raises(module.PreparationError, match="output_paths_not_disjoint"):
        module.write_prepared_authorization(
            prepared, payload_path=output, receipt_path=output
        )

    assert not output.exists()


def test_preparation_and_write_do_not_sign_or_consume_authority(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = _implementation()

    def forbidden_process(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("unsigned preparation attempted signing or a subprocess")

    monkeypatch.setattr("subprocess.run", forbidden_process)
    monkeypatch.setattr("subprocess.Popen", forbidden_process)
    prepared, _calls, _environment_map, _repositories, private_roots = _prepare(
        tmp_path / "inputs"
    )
    output = _private_root(tmp_path / "operator")
    module.write_prepared_authorization(
        prepared,
        payload_path=output / "authorization.json",
        receipt_path=output / "receipt.json",
    )

    assert all(not any(root.iterdir()) for root in private_roots)
    assert "signature" not in {path.name for path in output.iterdir()}
    assert "consumed" not in {path.name for path in output.iterdir()}


def test_secure_writer_uses_exclusive_nofollow_flags(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = _implementation()
    prepared, *_ = _prepare(tmp_path / "inputs")
    output = _private_root(tmp_path / "operator")
    original_open = module.os.open
    observed_flags: list[int] = []

    def recording_open(
        path: object, flags: int, mode: int = 0o777, **kwargs: object
    ) -> int:
        if flags & os.O_CREAT:
            observed_flags.append(flags)
        return original_open(path, flags, mode, **kwargs)

    monkeypatch.setattr(module.os, "open", recording_open)
    module.write_prepared_authorization(
        prepared,
        payload_path=output / "authorization.json",
        receipt_path=output / "receipt.json",
    )

    assert len(observed_flags) == 2
    assert all(flags & os.O_EXCL for flags in observed_flags)
    assert all(flags & os.O_NOFOLLOW for flags in observed_flags)
