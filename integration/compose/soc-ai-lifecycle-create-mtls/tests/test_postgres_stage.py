from __future__ import annotations

import hashlib
import importlib
import json
import os
import sys
from dataclasses import dataclass, replace
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_mtls import postgres_stage
from cybrik_suite_uat_mtls import runtime_authorization as runtime_auth

HEX = {
    "aggregate": "a" * 64,
    "authorization": "b" * 64,
    "grant": "c" * 64,
    "marker": "",
    "tuple": "d" * 64,
}


@dataclass(frozen=True, slots=True)
class _Identity:
    repository: str
    commit: str
    tree: str
    clean: bool = True


@dataclass(frozen=True, slots=True)
class _ExternalRoot:
    capability: str
    root: Path


@dataclass(frozen=True, slots=True)
class _RepositoryRoot:
    repository: str
    root: Path


def _tuple() -> tuple[_Identity, ...]:
    return tuple(
        _Identity(repository=name, commit=str(index) * 40, tree=str(index + 4) * 40)
        for index, name in enumerate(
            (
                "cybrik-soc-command-center",
                "cybrik-cyber-ai-platform",
                "cybrik-security-tool-fabric",
                "cybrik-suite",
            ),
            start=1,
        )
    )


def _context(tmp_path: Path) -> SimpleNamespace:
    evidence_root = tmp_path / "master-evidence"
    evidence_root.mkdir(mode=0o700)
    marker = evidence_root / ".cybrik-integrated-uat-consumed.json"
    identities = _tuple()
    tuple_payload = (
        json.dumps(
            [
                {
                    "clean": item.clean,
                    "commit": item.commit,
                    "repository": item.repository,
                    "tree": item.tree,
                }
                for item in identities
            ],
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode()
    tuple_sha256 = hashlib.sha256(tuple_payload).hexdigest()
    external_roots = tuple(
        _ExternalRoot(capability=capability, root=tmp_path / leaf)
        for capability, leaf in (
            ("postgres_d2_runtime", "cybrik-uat-d2-runtime-integrated-uat-0001"),
            ("postgres_d2_evidence", "cybrik-uat-d2-evidence-integrated-uat-0001"),
            (
                "alert_context_runtime",
                "cybrik-alert-context-runtime-integrated-uat-0001",
            ),
            (
                "alert_context_evidence",
                "cybrik-alert-context-evidence-integrated-uat-0001",
            ),
            ("alert_context_state", "cybrik-alert-context-state-integrated-uat-0001"),
        )
    )
    for binding in external_roots:
        binding.root.mkdir(mode=0o700)
    external_root_payload = (
        json.dumps(
            [
                {"capability": item.capability, "root": str(item.root)}
                for item in external_roots
            ],
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode()
    external_roots_sha256 = hashlib.sha256(external_root_payload).hexdigest()
    repository_roots = tuple(
        _RepositoryRoot(repository=item.repository, root=tmp_path / item.repository)
        for item in identities
    )
    for binding in repository_roots:
        binding.root.mkdir(mode=0o700)
    repository_roots_payload = (
        json.dumps(
            [
                {"repository": item.repository, "root": str(item.root)}
                for item in repository_roots
            ],
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode()
    repository_roots_sha256 = hashlib.sha256(repository_roots_payload).hexdigest()
    document = {
        "aggregate_sha256": HEX["aggregate"],
        "authorization_sha256": HEX["authorization"],
        "external_roots_sha256": external_roots_sha256,
        "exact_head_grant_sha256": HEX["grant"],
        "one_shot": True,
        "repository_roots_sha256": repository_roots_sha256,
        "repository_tuple_sha256": tuple_sha256,
        "run_id": "integrated-uat-0001",
        "status": "consumed",
    }
    payload = (
        json.dumps(document, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode()
    marker.write_bytes(payload)
    marker.chmod(0o600)
    master_artifacts = tuple(
        tmp_path / name
        for name in (
            "master-authorization.json",
            "master-authorization.sig",
            "allowed-signers",
        )
    )
    for artifact in master_artifacts:
        artifact.write_bytes(b"fixture")
        artifact.chmod(0o600)
    b1_wheel = tmp_path / "b1.whl"
    b1_wheel.write_bytes(b"pinned b1 fixture")
    b1_wheel.chmod(0o600)
    return SimpleNamespace(
        aggregate_sha256=HEX["aggregate"],
        authorization_sha256=HEX["authorization"],
        consumption_marker=marker,
        evidence_root=evidence_root,
        external_roots_sha256=external_roots_sha256,
        marker_sha256=hashlib.sha256(payload).hexdigest(),
        repository_tuple=identities,
        repository_tuple_sha256=tuple_sha256,
        repository_roots_sha256=repository_roots_sha256,
        run_id="integrated-uat-0001",
        master_authorization_file=master_artifacts[0],
        master_authorization_signature=master_artifacts[1],
        master_allowed_signers=master_artifacts[2],
        b1_wheel=b1_wheel,
        b1_wheel_sha256=hashlib.sha256(b1_wheel.read_bytes()).hexdigest(),
        configured_external_roots=external_roots,
        configured_repository_roots=repository_roots,
    )


def _adapter(
    context: SimpleNamespace, operations
) -> postgres_stage.PostgresD2StageAdapter:
    return postgres_stage.PostgresD2StageAdapter(
        operations,
        external_roots=context.configured_external_roots,
        repository_roots=context.configured_repository_roots,
    )


def _observed_tuple() -> dict[str, dict[str, str]]:
    identities = _tuple()
    by_name = {item.repository: item for item in identities}
    return {
        role: {
            "clean": True,
            "commit_sha": by_name[name].commit,
            "tree_sha": by_name[name].tree,
        }
        for role, name in (
            ("suite", "cybrik-suite"),
            ("soc", "cybrik-soc-command-center"),
            ("ai", "cybrik-cyber-ai-platform"),
            ("fabric", "cybrik-security-tool-fabric"),
        )
    }


def _operations(
    events: list[str],
    *,
    absence: bool = True,
    observed_tuple: dict[str, dict[str, str]] | None = None,
):
    authorization = SimpleNamespace(
        authorization_sha256=HEX["authorization"],
        runtime_root=Path("/opt/cybrik-uat-d2-runtime-integrated-uat-0001"),
    )

    def record(name: str, value=None):
        def callback(*_args):
            events.append(name)
            return value

        return callback

    return postgres_stage.StageOperations(
        authorize=record("authorize", authorization),
        observe_repository_tuple=record(
            "observe_tuple", observed_tuple or _observed_tuple()
        ),
        prepare=record("prepare", authorization),
        start=record("start"),
        seed=record("seed"),
        reset=record("reset"),
        run_attempt=record(
            "run_attempt",
            {
                "case_count": 10,
                "failed_count": 0,
                "passed_count": 10,
                "postgres_replay_row_count": 1,
            },
        ),
        teardown=record("teardown"),
        inspect_absence=record(
            "inspect_absence",
            {
                "completed": absence,
                "ai_process_absent": absence,
                "soc_process_absent": absence,
                "postgres_container_absent": absence,
                "ai_listener_absent": absence,
                "postgres_listener_absent": absence,
                "runtime_root_absent": absence,
                "pki_absent": absence,
                "control_root_absent": absence,
            },
        ),
    )


def test_stage_runs_under_master_marker_without_child_consumption_or_terminal(
    tmp_path: Path,
) -> None:
    events: list[str] = []
    context = _context(tmp_path)
    adapter = _adapter(context, _operations(events))

    receipt = adapter.run(context)

    assert events == [
        "authorize",
        "observe_tuple",
        "prepare",
        "start",
        "seed",
        "reset",
        "run_attempt",
    ]
    assert receipt.stage == "postgres_d2"
    assert receipt.aggregate_sha256 == context.aggregate_sha256
    assert receipt.repository_tuple_sha256 == context.repository_tuple_sha256
    assert receipt.master_marker_sha256 == context.marker_sha256
    assert receipt.stage_authorization_sha256 == context.authorization_sha256
    assert receipt.external_roots_sha256 == context.external_roots_sha256
    assert (
        receipt.receipt_sha256
        == hashlib.sha256(
            postgres_stage.canonical_receipt_bytes(receipt.to_record())
        ).hexdigest()
    )
    assert not any(
        (context.evidence_root / name).exists()
        for name in (
            "terminal-result.json",
            "terminal-teardown.json",
            "terminal-summary.json",
            "combined-terminal-seal.json",
        )
    )


def test_stage_teardown_and_absence_are_separate_and_inspectable(
    tmp_path: Path,
) -> None:
    events: list[str] = []
    context = _context(tmp_path)
    adapter = _adapter(context, _operations(events))

    adapter.teardown(context)
    observed = adapter.inspect_absence(context)
    adapter.verify_absent(context)

    assert observed.completed is True
    assert observed.postgres_container_absent is True
    assert events == [
        "authorize",
        "observe_tuple",
        "teardown",
        "authorize",
        "observe_tuple",
        "inspect_absence",
        "authorize",
        "observe_tuple",
        "inspect_absence",
    ]


def test_stage_rejects_tampered_master_marker_before_any_effect(tmp_path: Path) -> None:
    events: list[str] = []
    context = _context(tmp_path)
    context.consumption_marker.write_text("{}\n", encoding="utf-8")
    adapter = _adapter(context, _operations(events))

    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        adapter.run(context)

    assert events == []


def test_stage_rejects_repository_drift_before_start(tmp_path: Path) -> None:
    events: list[str] = []
    context = _context(tmp_path)
    changed = _observed_tuple()
    changed["soc"] = {**changed["soc"], "commit_sha": "f" * 40}
    adapter = _adapter(context, _operations(events, observed_tuple=changed))

    with pytest.raises(postgres_stage.StageFailure, match="repository_tuple_mismatch"):
        adapter.run(context)

    assert events == ["authorize", "observe_tuple"]


def test_stage_rejects_dirty_repository_before_start(tmp_path: Path) -> None:
    events: list[str] = []
    context = _context(tmp_path)
    changed = _observed_tuple()
    changed["soc"] = {**changed["soc"], "clean": False}
    adapter = _adapter(context, _operations(events, observed_tuple=changed))

    with pytest.raises(postgres_stage.StageFailure, match="repository_tuple_mismatch"):
        adapter.run(context)

    assert events == ["authorize", "observe_tuple"]


def test_stage_tuple_observation_adds_cleanliness_for_every_live_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    roots = {
        "suite": tmp_path / "suite",
        "soc": tmp_path / "soc",
        "ai": tmp_path / "ai",
        "fabric": tmp_path / "fabric",
    }
    authorization = SimpleNamespace(
        suite_root=roots["suite"],
        product_roots={
            "soc": roots["soc"],
            "cyber_ai": roots["ai"],
            "tool_fabric": roots["fabric"],
        },
    )
    base = _observed_tuple()
    for identity in base.values():
        identity.pop("clean")
    observed_roots: list[Path] = []
    monkeypatch.setattr(
        postgres_stage.harness,
        "_repository_tuple",
        lambda _authorization: base,
    )
    monkeypatch.setattr(
        postgres_stage.harness,
        "_git_clean",
        lambda root: observed_roots.append(root) is None and root != roots["soc"],
    )

    observed = postgres_stage.harness._stage_repository_tuple(authorization)

    assert observed_roots == [
        roots["suite"],
        roots["soc"],
        roots["ai"],
        roots["fabric"],
    ]
    assert observed["soc"]["clean"] is False
    assert all(observed[role]["clean"] is True for role in ("suite", "ai", "fabric"))


def test_verify_absent_fails_closed_on_any_residual(tmp_path: Path) -> None:
    events: list[str] = []
    context = _context(tmp_path)
    adapter = _adapter(context, _operations(events, absence=False))

    with pytest.raises(postgres_stage.StageFailure, match="stage_residual_present"):
        adapter.verify_absent(context)


def test_stage_rejects_forged_tuple_digest_before_authorization(tmp_path: Path) -> None:
    events: list[str] = []
    context = _context(tmp_path)
    context.repository_tuple_sha256 = "f" * 64
    marker = json.loads(context.consumption_marker.read_text(encoding="utf-8"))
    marker["repository_tuple_sha256"] = context.repository_tuple_sha256
    payload = (
        json.dumps(marker, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode()
    context.consumption_marker.write_bytes(payload)
    context.consumption_marker.chmod(0o600)
    context.marker_sha256 = hashlib.sha256(payload).hexdigest()
    adapter = _adapter(context, _operations(events))

    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        adapter.run(context)

    assert events == []


def test_default_operations_bind_only_non_consuming_harness_seams() -> None:
    operations = postgres_stage._default_operations()

    assert (
        operations.authorize
        is postgres_stage.runtime_authorization.authorize_from_master_reservation
    )
    assert (
        operations.prepare
        is postgres_stage.runtime_authorization.prepare_master_stage_roots
    )
    assert (
        operations.observe_repository_tuple
        is postgres_stage.harness._stage_repository_tuple
    )
    assert operations.start is postgres_stage.harness._stage_start
    assert operations.seed is postgres_stage.harness._stage_seed
    assert operations.reset is postgres_stage.harness._stage_reset
    assert operations.run_attempt is postgres_stage.harness._stage_run_runtime_attempt
    assert operations.teardown is postgres_stage.harness._stage_teardown
    assert operations.inspect_absence is postgres_stage.harness._stage_absence_state


def test_stage_start_ready_callback_does_not_consume_child_authority(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    authorization = object()
    callbacks: list[object] = []
    monkeypatch.setattr(
        postgres_stage.harness, "assert_product_api_compatibility", lambda _: None
    )
    monkeypatch.setattr(
        postgres_stage.harness,
        "_start_runtime",
        lambda actual, *, on_supervisor_ready: callbacks.extend(
            (actual, on_supervisor_ready)
        ),
    )
    monkeypatch.setattr(
        postgres_stage.harness.runtime_authorization,
        "consume_once",
        lambda _: pytest.fail("stage path consumed child authorization"),
    )

    postgres_stage.harness._stage_start(authorization)  # type: ignore[arg-type]
    callback = callbacks[1]
    assert callable(callback)
    callback()

    assert callbacks[0] is authorization


def test_adapter_matches_live_master_model_and_digest(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    context = _context(tmp_path)
    integrated_src = Path(__file__).parents[2] / "integrated-uat" / "src"
    monkeypatch.syspath_prepend(str(integrated_src))
    models = importlib.import_module("cybrik_suite_integrated_uat.models")
    external_roots = tuple(
        models.ExternalRootBinding(capability=item.capability, root=item.root)
        for item in context.configured_external_roots
    )
    repository_roots = tuple(
        models.RepositoryRoot(repository=item.repository, root=item.root)
        for item in context.configured_repository_roots
    )
    live_context = models.OrchestrationContext(
        aggregate_sha256=context.aggregate_sha256,
        authorization_sha256=context.authorization_sha256,
        consumption_marker=context.consumption_marker,
        evidence_root=context.evidence_root,
        external_roots_sha256=models.external_roots_digest(external_roots),
        marker_sha256=context.marker_sha256,
        repository_roots_sha256=models.repository_roots_digest(repository_roots),
        repository_tuple=tuple(
            models.RepositoryIdentity(
                repository=item.repository,
                commit=item.commit,
                tree=item.tree,
                clean=item.clean,
            )
            for item in context.repository_tuple
        ),
        repository_tuple_sha256=context.repository_tuple_sha256,
        run_id=context.run_id,
    )
    stage_context = SimpleNamespace(
        **{
            field: getattr(live_context, field)
            for field in (
                "aggregate_sha256",
                "authorization_sha256",
                "consumption_marker",
                "evidence_root",
                "external_roots_sha256",
                "marker_sha256",
                "repository_roots_sha256",
                "repository_tuple",
                "repository_tuple_sha256",
                "run_id",
            )
        },
        master_authorization_file=context.master_authorization_file,
        master_authorization_signature=context.master_authorization_signature,
        master_allowed_signers=context.master_allowed_signers,
        b1_wheel=context.b1_wheel,
        b1_wheel_sha256=context.b1_wheel_sha256,
    )

    receipt = postgres_stage.PostgresD2StageAdapter(
        _operations([]),
        external_roots=external_roots,
        repository_roots=repository_roots,
    ).run(stage_context)

    assert receipt.external_roots_sha256 == models.external_roots_digest(external_roots)
    assert receipt.repository_tuple_sha256 == live_context.repository_tuple_sha256


def test_master_reserved_binding_prepares_only_nested_pki_without_cybrik_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    suite_root = Path(runtime_auth.__file__).resolve().parents[5]
    names = (
        "cybrik-soc-command-center",
        "cybrik-cyber-ai-platform",
        "cybrik-security-tool-fabric",
        "cybrik-suite",
    )
    repository_roots = tuple(
        (name, suite_root if name == "cybrik-suite" else tmp_path / name)
        for name in names
    )
    for name, root in repository_roots:
        if name != "cybrik-suite":
            root.mkdir(mode=0o700)
    external_roots = tuple(
        (capability, tmp_path / leaf)
        for capability, leaf in (
            ("postgres_d2_runtime", "cybrik-uat-d2-runtime-master-reserved"),
            ("postgres_d2_evidence", "cybrik-uat-d2-evidence-master-reserved"),
            ("alert_context_runtime", "alert-runtime"),
            ("alert_context_evidence", "alert-evidence"),
            ("alert_context_state", "alert-state"),
        )
    )
    for _capability, root in external_roots:
        root.mkdir(mode=0o700)
    master_evidence = tmp_path / "master-evidence"
    master_evidence.mkdir(mode=0o700)
    identities = _tuple()
    signed_repository_tuple = tuple(
        (item.repository, item.commit, item.tree) for item in identities
    )
    signed_repository_tuple_sha256 = hashlib.sha256(
        postgres_stage.canonical_receipt_bytes(
            [
                {
                    "clean": True,
                    "commit": commit,
                    "repository": repository,
                    "tree": tree,
                }
                for repository, commit, tree in signed_repository_tuple
            ]
        )
    ).hexdigest()
    facts = runtime_auth.MasterReservationFacts(
        aggregate_sha256="a" * 64,
        b1_wheel=tmp_path / "b1.whl",
        b1_wheel_sha256="9" * 64,
        authorization_file=tmp_path / "master-authorization.json",
        authorization_sha256="b" * 64,
        authorization_signature=tmp_path / "master-authorization.sig",
        allowed_signers_file=tmp_path / "allowed-signers",
        exact_head_grant_sha256="c" * 64,
        external_roots=external_roots,
        external_roots_sha256=runtime_auth._master_external_roots_digest(
            external_roots
        ),
        master_evidence_root=master_evidence,
        marker_sha256="d" * 64,
        postgres_evidence_root=dict(external_roots)["postgres_d2_evidence"],
        postgres_runtime_root=dict(external_roots)["postgres_d2_runtime"],
        repository_roots=repository_roots,
        repository_roots_sha256=runtime_auth._master_repository_roots_digest(
            {
                "soc": dict(repository_roots)["cybrik-soc-command-center"],
                "cyber_ai": dict(repository_roots)["cybrik-cyber-ai-platform"],
                "tool_fabric": dict(repository_roots)["cybrik-security-tool-fabric"],
                "suite": suite_root,
            }
        ),
        repository_tuple=signed_repository_tuple,
        repository_tuple_sha256=signed_repository_tuple_sha256,
        run_id="master-reserved",
    )
    marker_payload = postgres_stage.canonical_receipt_bytes(
        {
            "aggregate_sha256": facts.aggregate_sha256,
            "authorization_sha256": facts.authorization_sha256,
            "exact_head_grant_sha256": facts.exact_head_grant_sha256,
            "external_roots_sha256": facts.external_roots_sha256,
            "one_shot": True,
            "repository_roots_sha256": facts.repository_roots_sha256,
            "repository_tuple_sha256": facts.repository_tuple_sha256,
            "run_id": facts.run_id,
            "status": "consumed",
        }
    )
    marker = master_evidence / runtime_auth.MASTER_CONSUMPTION_MARKER
    marker.write_bytes(marker_payload)
    marker.chmod(0o600)
    facts = replace(facts, marker_sha256=hashlib.sha256(marker_payload).hexdigest())
    for name in tuple(os.environ):
        if name.startswith("CYBRIK_UAT_D2_"):
            monkeypatch.delenv(name, raising=False)

    monkeypatch.setattr(
        runtime_auth, "verify_signed_master_reservation", lambda _: None
    )
    binding = runtime_auth.authorize_from_master_reservation(facts)
    prepared = runtime_auth.prepare_master_stage_roots(binding)

    assert isinstance(binding, runtime_auth.ReservedRuntimeBinding)
    assert binding.repository_tuple == facts.repository_tuple
    assert binding.master_reservation == facts
    assert (
        runtime_auth.master_reservation_from_payload(
            runtime_auth.master_reservation_payload(binding)
        )
        == facts
    )
    runtime_auth.verify_master_consumption(facts)
    assert prepared.prepared_roots is not None
    assert prepared.runtime_root.is_dir()
    assert (prepared.runtime_root / "pki").is_dir()
    assert prepared.evidence_root.is_dir()
    assert not (prepared.evidence_root / runtime_auth.CONSUMPTION_MARKER).exists()
    monkeypatch.setattr(
        postgres_stage.harness,
        "_control_paths",
        lambda _authorization: SimpleNamespace(root=tmp_path / "control"),
    )
    postgres_stage.harness._stage_teardown(prepared)
    assert prepared.runtime_root.is_dir()
    assert not any(prepared.runtime_root.iterdir())
    assert not (prepared.runtime_root / "pki").exists()
    monkeypatch.setattr(
        postgres_stage.harness,
        "_process_absence_state",
        lambda: {"ai_process_absent": True, "soc_process_absent": True},
    )
    monkeypatch.setattr(postgres_stage.harness.store, "container_exists", lambda: False)
    monkeypatch.setattr(postgres_stage.harness, "_listener_absent", lambda _port: True)
    monkeypatch.setattr(
        postgres_stage.harness.pki, "verify_absent", lambda _material: True
    )
    monkeypatch.setattr(
        postgres_stage.harness.process_control,
        "control_root_absent",
        lambda _root: True,
    )
    assert all(postgres_stage.harness._stage_absence_state(binding).values())

    with pytest.raises(
        runtime_auth.RuntimeAuthorizationFailure, match="master_reservation_invalid"
    ):
        runtime_auth.authorize_from_master_reservation(
            replace(facts, repository_tuple_sha256="f" * 64)
        )

    marker.write_text("{}\n", encoding="utf-8")
    with pytest.raises(
        runtime_auth.RuntimeAuthorizationFailure,
        match="master_consumption_marker_invalid",
    ):
        runtime_auth.verify_master_consumption(facts)


def _direct_stage_argv(context: SimpleNamespace, action: str) -> list[str]:
    arguments = [
        action,
        "--run-id",
        context.run_id,
        "--aggregate-sha256",
        context.aggregate_sha256,
        "--repository-tuple-sha256",
        context.repository_tuple_sha256,
        "--repository-roots-sha256",
        context.repository_roots_sha256,
        "--external-roots-sha256",
        context.external_roots_sha256,
        "--authorization-sha256",
        context.authorization_sha256,
        "--marker-sha256",
        context.marker_sha256,
        "--consumption-marker",
        str(context.consumption_marker),
        "--evidence-root",
        str(context.evidence_root),
    ]
    for item in context.configured_repository_roots:
        arguments.extend(("--repository", f"{item.repository}={item.root}"))
    for item in context.repository_tuple:
        arguments.extend(
            (
                "--repository-identity",
                f"{item.repository}={item.commit}:{item.tree}",
            )
        )
    for item in context.configured_external_roots:
        arguments.extend(("--external-root", f"{item.capability}={item.root}"))
    arguments.extend(
        (
            "--master-authorization-file",
            str(context.master_authorization_file),
            "--master-authorization-signature",
            str(context.master_authorization_signature),
            "--master-allowed-signers",
            str(context.master_allowed_signers),
            "--b1-wheel",
            str(context.b1_wheel),
            "--b1-wheel-sha256",
            context.b1_wheel_sha256,
        )
    )
    return arguments


def test_stage_script_accepts_exact_master_argv_and_emits_public_v1(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    context = _context(tmp_path)
    script_root = Path(__file__).parents[1] / "scripts"
    monkeypatch.syspath_prepend(str(script_root))
    script = importlib.import_module("integrated_uat_stage")
    captured: dict[str, object] = {}

    class _Adapter:
        def __init__(self, *, external_roots: object, repository_roots: object):
            captured["external_roots"] = external_roots
            captured["repository_roots"] = repository_roots

        def run(self, actual: object) -> object:
            captured["context"] = actual
            return object()

        def verify_absent(self, actual: object) -> None:
            captured["absence_context"] = actual

    monkeypatch.setattr(script.postgres_stage, "PostgresD2StageAdapter", _Adapter)

    assert script.main(_direct_stage_argv(context, "run")) == 0

    document = json.loads(capsys.readouterr().out)
    assert set(document) == {
        "aggregate_sha256",
        "external_roots_sha256",
        "master_authorization_sha256",
        "master_marker_sha256",
        "repository_roots_sha256",
        "repository_tuple_sha256",
        "run_id",
        "schema",
        "stage",
        "status",
    }
    assert document["schema"] == "cybrik.integrated-uat.public-stage-receipt/v1"
    assert document["stage"] == "postgres_d2"
    assert document["status"] == "passed"
    assert (
        tuple(
            item.capability
            for item in captured["external_roots"]  # type: ignore[union-attr]
        )
        == postgres_stage._EXTERNAL_ROOT_ROLES
    )

    assert script.main(_direct_stage_argv(context, "verify-absent")) == 0
    absence = json.loads(capsys.readouterr().out)
    assert set(absence) == {
        "absent",
        "aggregate_sha256",
        "authorization_sha256",
        "external_roots_sha256",
        "marker_sha256",
        "repository_roots_sha256",
        "repository_tuple_sha256",
        "run_id",
        "schema",
        "scope",
    }
    assert absence["schema"] == "cybrik.integrated-uat.absence/v1"
    assert absence["scope"] == "postgres_d2"
    assert absence["absent"] is True


def test_live_master_adapter_argv_is_accepted_by_real_postgres_parser(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    script_root = Path(__file__).parents[1] / "scripts"
    integrated_src = Path(__file__).parents[2] / "integrated-uat" / "src"
    monkeypatch.syspath_prepend(str(script_root))
    monkeypatch.syspath_prepend(str(integrated_src))
    script = importlib.import_module("integrated_uat_stage")
    adapters = importlib.import_module("cybrik_suite_integrated_uat.adapters")
    models = importlib.import_module("cybrik_suite_integrated_uat.models")
    suite_root = Path(__file__).parents[4]
    base = _context(tmp_path)
    repository_roots = tuple(
        models.RepositoryRoot(
            repository=item.repository,
            root=(suite_root if item.repository == "cybrik-suite" else item.root),
        )
        for item in base.configured_repository_roots
    )
    external_roots = tuple(
        models.ExternalRootBinding(capability=item.capability, root=item.root)
        for item in base.configured_external_roots
    )
    identities = tuple(
        models.RepositoryIdentity(
            repository=item.repository,
            commit=item.commit,
            tree=item.tree,
            clean=True,
        )
        for item in base.repository_tuple
    )
    authorization = models.MasterAuthorization(
        aggregate_sha256=base.aggregate_sha256,
        authorization_sha256=base.authorization_sha256,
        evidence_root=base.evidence_root,
        exact_head_grant_sha256=HEX["grant"],
        external_roots=external_roots,
        external_roots_sha256=models.external_roots_digest(external_roots),
        repository_roots=repository_roots,
        repository_roots_sha256=models.repository_roots_digest(repository_roots),
        repository_tuple=identities,
        repository_tuple_sha256=models.repository_tuple_digest(identities),
        run_id=base.run_id,
    )
    context = models.OrchestrationContext(
        aggregate_sha256=authorization.aggregate_sha256,
        authorization_sha256=authorization.authorization_sha256,
        consumption_marker=base.consumption_marker,
        evidence_root=authorization.evidence_root,
        external_roots_sha256=authorization.external_roots_sha256,
        marker_sha256=base.marker_sha256,
        repository_roots_sha256=authorization.repository_roots_sha256,
        repository_tuple=authorization.repository_tuple,
        repository_tuple_sha256=authorization.repository_tuple_sha256,
        run_id=authorization.run_id,
    )
    parsed_actions: list[str] = []

    def executor(argv: tuple[str, ...], **_kwargs: object) -> object:
        arguments = script._arguments(argv[4:])
        parsed_context, _repositories, _external = script._command_inputs(arguments)
        parsed_actions.append(arguments.action)
        output = (
            script._public_receipt(parsed_context)
            if arguments.action == "run"
            else script._absence_receipt(parsed_context)
        )
        return SimpleNamespace(returncode=0, stdout=output, stderr=b"")

    script_path = suite_root / adapters.POSTGRES_D2_SCRIPT
    adapter = adapters.PostgresD2Stage(
        authorization_file=base.master_authorization_file,
        authorization_signature=base.master_authorization_signature,
        allowed_signers_file=base.master_allowed_signers,
        b1_wheel=base.b1_wheel,
        b1_wheel_sha256=base.b1_wheel_sha256,
        authorization=authorization,
        executor=executor,
        python_executable=Path(sys.executable).resolve(),
        script_sha256=hashlib.sha256(script_path.read_bytes()).hexdigest(),
        suite_root=suite_root,
    )

    receipt = adapter.run(context)
    adapter.verify_absent(context)

    assert receipt.stage == "postgres_d2"
    assert parsed_actions == ["run", "verify-absent"]


def test_stage_script_fails_closed_and_dispatches_teardown(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    context = _context(tmp_path)
    script_root = Path(__file__).parents[1] / "scripts"
    monkeypatch.syspath_prepend(str(script_root))
    script = importlib.import_module("integrated_uat_stage")
    with pytest.raises(ValueError, match="repository_binding_invalid"):
        script._binding("wrong=/tmp", expected="expected", kind="repository")
    with pytest.raises(ValueError, match="stage_arguments_invalid"):
        script._arguments(["run"])

    arguments = script._arguments(_direct_stage_argv(context, "run"))
    arguments.repository = []
    with pytest.raises(ValueError, match="stage_arguments_invalid"):
        script._command_inputs(arguments)
    arguments = script._arguments(_direct_stage_argv(context, "run"))
    arguments.repository_identity[0] = "wrong=not-an-identity"
    with pytest.raises(ValueError, match="repository_identity_binding_invalid"):
        script._command_inputs(arguments)

    events: list[str] = []

    class _Adapter:
        def __init__(self, **_kwargs: object):
            pass

        def teardown(self, _context: object) -> None:
            events.append("teardown")

    monkeypatch.setattr(script.postgres_stage, "PostgresD2StageAdapter", _Adapter)
    assert script.main(_direct_stage_argv(context, "teardown")) == 0
    assert events == ["teardown"]
    assert capsys.readouterr().out == ""

    class _RefusingAdapter:
        def __init__(self, **_kwargs: object):
            pass

        def run(self, _context: object) -> None:
            raise postgres_stage.StageFailure("bounded_refusal")

    monkeypatch.setattr(
        script.postgres_stage, "PostgresD2StageAdapter", _RefusingAdapter
    )
    assert script.main(_direct_stage_argv(context, "run")) == 2
    assert "bounded_refusal" in capsys.readouterr().err


def test_boundary_helpers_reject_malformed_values(tmp_path: Path) -> None:
    context = _context(tmp_path)
    with pytest.raises(postgres_stage.StageFailure, match="stage_receipt_invalid"):
        postgres_stage.canonical_receipt_bytes({object()})
    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        postgres_stage._repository_tuple([])
    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        postgres_stage._repository_tuple((object(),) * 4)
    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        postgres_stage._external_roots(())
    bad_external = list(context.configured_external_roots)
    bad_external[0] = _ExternalRoot(capability="wrong", root=bad_external[0].root)
    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        postgres_stage._external_roots(tuple(bad_external))
    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        postgres_stage._repository_roots(())
    bad_repositories = list(context.configured_repository_roots)
    bad_repositories[0] = _RepositoryRoot(
        repository="wrong", root=bad_repositories[0].root
    )
    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        postgres_stage._repository_roots(tuple(bad_repositories))


def test_marker_parser_rejects_non_json_and_unsafe_mode(tmp_path: Path) -> None:
    context = _context(tmp_path)
    context.consumption_marker.write_bytes(b"not-json\n")
    context.consumption_marker.chmod(0o600)
    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        _adapter(context, _operations([])).run(context)

    second = tmp_path / "second"
    second.mkdir()
    context = _context(second)
    context.consumption_marker.chmod(0o644)
    with pytest.raises(postgres_stage.StageFailure, match="master_reservation_invalid"):
        _adapter(context, _operations([])).run(context)


def test_adapter_collapses_each_effect_boundary(tmp_path: Path) -> None:
    context = _context(tmp_path)
    base = _operations([])

    def fail(*_args):
        raise RuntimeError("must not escape")

    with pytest.raises(
        postgres_stage.StageFailure, match="postgres_d2_stage_admission_failed"
    ):
        _adapter(context, replace(base, authorize=fail)).run(context)
    with pytest.raises(postgres_stage.StageFailure, match="postgres_d2_stage_failed"):
        _adapter(context, replace(base, prepare=fail)).run(context)
    with pytest.raises(postgres_stage.StageFailure, match="postgres_d2_stage_failed"):
        _adapter(context, replace(base, run_attempt=lambda _auth: [])).run(context)
    with pytest.raises(
        postgres_stage.StageFailure, match="postgres_d2_teardown_failed"
    ):
        _adapter(context, replace(base, teardown=fail)).teardown(context)
    with pytest.raises(
        postgres_stage.StageFailure, match="stage_absence_observation_failed"
    ):
        _adapter(context, replace(base, inspect_absence=fail)).inspect_absence(context)
    with pytest.raises(
        postgres_stage.StageFailure, match="stage_absence_observation_failed"
    ):
        _adapter(
            context,
            replace(base, inspect_absence=lambda _auth: {"completed": True}),
        ).inspect_absence(context)
    invalid_absence = dict(base.inspect_absence(object()))
    invalid_absence["completed"] = 1
    with pytest.raises(
        postgres_stage.StageFailure, match="stage_absence_observation_failed"
    ):
        _adapter(
            context,
            replace(base, inspect_absence=lambda _auth: invalid_absence),
        ).inspect_absence(context)


def test_adapter_rejects_invalid_operations_and_stage_authority(tmp_path: Path) -> None:
    context = _context(tmp_path)
    with pytest.raises(TypeError, match="operations must be StageOperations"):
        postgres_stage.PostgresD2StageAdapter(
            object(),
            external_roots=context.configured_external_roots,
            repository_roots=context.configured_repository_roots,
        )
    invalid_authority = SimpleNamespace(
        authorization_sha256="f" * 64,
        runtime_root=Path("/opt/cybrik-uat-d2-runtime-invalid"),
    )
    with pytest.raises(
        postgres_stage.StageFailure, match="postgres_d2_stage_admission_failed"
    ):
        _adapter(
            context,
            replace(
                _operations([]),
                authorize=lambda _reservation: invalid_authority,
            ),
        ).run(context)
