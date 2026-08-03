from __future__ import annotations

import hashlib
import importlib
import io
import json
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_fabric import admission, integrated_stage, runtime_wiring


@dataclass(frozen=True, slots=True)
class _RepositoryRoot:
    repository: str
    root: Path


@dataclass(frozen=True, slots=True)
class _ExternalRoot:
    capability: str
    root: Path


def _canonical(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def _directory(path: Path) -> Path:
    path.mkdir(parents=True, mode=0o700)
    path.chmod(0o700)
    return path.resolve()


def _fixture(tmp_path: Path):
    repository_names = integrated_stage.EXPECTED_REPOSITORIES
    repositories = tuple(
        _RepositoryRoot(name, _directory(tmp_path / name)) for name in repository_names
    )
    _directory(repositories[0].root / "services/api/src")
    _directory(repositories[1].root / "services/ai-api/src")
    _directory(repositories[1].root / "packages/ai-core/src")
    _directory(repositories[2].root / "src/control-plane")
    external = tuple(
        _ExternalRoot(capability, _directory(tmp_path / capability))
        for capability in integrated_stage.EXPECTED_EXTERNAL_CAPABILITIES
    )
    identities = tuple(
        SimpleNamespace(
            repository=item.repository,
            commit=f"{index:x}" * 40,
            tree=f"{index + 4:x}" * 40,
            clean=True,
        )
        for index, item in enumerate(repositories, start=1)
    )
    tuple_sha = hashlib.sha256(
        _canonical(
            [
                {
                    "clean": True,
                    "commit": item.commit,
                    "repository": item.repository,
                    "tree": item.tree,
                }
                for item in identities
            ]
        )
    ).hexdigest()
    roots_sha = integrated_stage.repository_roots_digest(repositories)
    external_sha = integrated_stage.external_roots_digest(external)
    evidence_root = _directory(tmp_path / "master-evidence")
    marker = evidence_root / ".cybrik-integrated-uat-consumed.json"
    marker_document = {
        "aggregate_sha256": "a" * 64,
        "authorization_sha256": "b" * 64,
        "exact_head_grant_sha256": "c" * 64,
        "external_roots_sha256": external_sha,
        "one_shot": True,
        "repository_roots_sha256": roots_sha,
        "repository_tuple_sha256": tuple_sha,
        "run_id": "integrated-alert-0001",
        "status": "consumed",
    }
    marker_payload = _canonical(marker_document)
    marker.write_bytes(marker_payload)
    marker.chmod(0o600)
    context = SimpleNamespace(
        aggregate_sha256="a" * 64,
        authorization_sha256="b" * 64,
        consumption_marker=marker,
        evidence_root=evidence_root,
        external_roots_sha256=external_sha,
        marker_sha256=hashlib.sha256(marker_payload).hexdigest(),
        repository_roots_sha256=roots_sha,
        repository_tuple=identities,
        repository_tuple_sha256=tuple_sha,
        run_id="integrated-alert-0001",
    )
    wheel = tmp_path / runtime_wiring.B1_WHEEL_FILENAME
    wheel.write_bytes(b"wheel-fixture")
    wheel.chmod(0o600)
    python = tmp_path / "python"
    python.write_bytes(b"python-fixture")
    python.chmod(0o700)
    return context, repositories, external, wheel.resolve(), python.resolve()


class _Response:
    def __init__(self, status_code: int, document: object) -> None:
        self.status_code = status_code
        self._document = document

    def json(self) -> object:
        return self._document


class _Client:
    def __init__(self, responses: list[_Response]) -> None:
        self._responses = responses

    def post(self, _path: str, **_kwargs: object) -> _Response:
        return self._responses.pop(0)

    def get(self, _path: str) -> _Response:
        return self._responses.pop(0)


def _adapters(events: list[str], observations, aggregate, journal: Path):
    class _Supervisor:
        owned_roles: tuple[str, ...] = ()

        def start_role(self, role: str) -> None:
            events.append(f"start:{role}")
            self.owned_roles = (*self.owned_roles, role)

        def stop_role(self, role: str) -> None:
            events.append(f"stop:{role}")
            self.owned_roles = tuple(item for item in self.owned_roles if item != role)

    session = runtime_wiring.RuntimeSession(
        supervisor=_Supervisor(),
        cleanup=lambda: events.append("finalize"),
        absence_probe=lambda: {
            name: True for name in runtime_wiring.runner.REQUIRED_ABSENCE_CHECKS
        },
        runtime_context=SimpleNamespace(
            config=SimpleNamespace(),
            journal_root=journal,
            scratch_root=journal.parent / "scratch",
            clients={},
        ),
    )
    case_wiring = runtime_wiring.runtime_case_wiring.RuntimeCaseWiring(
        positive_client=_Client([_Response(200, {"outcome": "completed"})]),
        f1_client=_Client(
            [
                _Response(
                    403,
                    {
                        "status": "denied",
                        "error": {
                            "code": "ACTOR_BINDING_MISMATCH",
                            "retryable": False,
                        },
                    },
                )
            ]
        ),
        soc_metrics_client=_Client(
            [_Response(200, {"soc_calls": 1}), _Response(200, {"soc_calls": 1})]
        ),
        ai_metrics_client=_Client(
            [
                _Response(200, {"model_calls": 1}),
                _Response(200, {"model_calls": 1}),
            ]
        ),
        positive_request={"request_id": "positive"},
        f1_request={"idempotency_key": "idem-f1-actor-mismatch-0001"},
        journal_root=journal,
        scratch_root=journal.parent / "scratch",
        authoritative_receipt_probe=lambda: {
            "receipt_verified": True,
            "durable_receipt": True,
            "side_effect_performed": False,
        },
        copied_receipt_tamper_probe=lambda _copy: {
            "disposition": "unverifiable",
            "receipt": None,
        },
    )
    return runtime_wiring.WiringAdapters(
        prepare_session=lambda _config, _binding: session,
        build_case_wiring=lambda _config, _binding, _session: case_wiring,
        now=lambda: datetime.now(UTC),
        observe=lambda _expectations: observations,
        aggregate=lambda _observations, _allowlist: aggregate,
    )


def test_master_reserved_builder_uses_one_authority_and_runs_without_child_gate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    context, repositories, external, wheel, python = _fixture(tmp_path)
    monkeypatch.setattr(
        integrated_stage,
        "B1_WHEEL_SHA256",
        hashlib.sha256(wheel.read_bytes()).hexdigest(),
    )
    role_roots = (repositories[3], repositories[0], repositories[1], repositories[2])
    observations = tuple(
        admission.RepositoryObservation(
            role,
            item.root,
            next(
                identity.commit
                for identity in context.repository_tuple
                if identity.repository == item.repository
            ),
            next(
                identity.tree
                for identity in context.repository_tuple
                if identity.repository == item.repository
            ),
        )
        for role, item in zip(admission.REPOSITORY_ROLES, role_roots, strict=True)
    )
    aggregate = admission.TrackedBlobAggregate(
        admission.TRACKED_BLOB_ALGORITHM, 73, context.aggregate_sha256
    )
    journal = _directory(tmp_path / "journal")
    (journal / "receipt.json").write_text("{}", encoding="utf-8")
    events: list[str] = []

    plan = integrated_stage.build_master_reserved_stage_dependencies(
        master_context=context,
        repository_roots=repositories,
        external_roots=external,
        b1_wheel=wheel,
        pinned_python=python,
        pinned_python_sha256=hashlib.sha256(python.read_bytes()).hexdigest(),
        adapters=_adapters(events, observations, aggregate, journal),
        master_allowlist=runtime_wiring.TRACKED_ALLOWLIST,
    )

    assert isinstance(plan.binding, integrated_stage.ReservedRuntimeBinding)
    assert not isinstance(plan.binding, admission.ExternalAuthorization)
    assert plan.binding.authorization_sha256 == context.authorization_sha256
    assert plan.binding.aggregate == aggregate
    with pytest.raises(integrated_stage.IntegratedStageFailure):
        plan.dependencies.authorize()
    with pytest.raises(integrated_stage.IntegratedStageFailure):
        plan.dependencies.consume_authorization(plan.binding, "f" * 64)
    with pytest.raises(integrated_stage.IntegratedStageFailure):
        plan.dependencies.evidence_root_for(plan.binding)

    result = runtime_wiring.run_reserved_stage(plan.dependencies, plan.binding)

    assert [item["case_id"] for item in result.cases] == ["positive", "F1", "F2"]
    assert all(result.absence.values())
    assert all(item.root.is_dir() for item in external)
    assert list(external[3].root.iterdir()) == []
    assert list(external[4].root.iterdir()) == []
    assert events == [
        "start:soc",
        "start:fabric",
        "start:ai",
        "stop:ai",
        "stop:fabric",
        "stop:soc",
        "finalize",
    ]


def test_master_marker_tamper_fails_before_observation_or_prepare(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    context, repositories, external, wheel, python = _fixture(tmp_path)
    monkeypatch.setattr(
        integrated_stage,
        "B1_WHEEL_SHA256",
        hashlib.sha256(wheel.read_bytes()).hexdigest(),
    )
    context.consumption_marker.write_text("{}\n", encoding="utf-8")
    events: list[str] = []
    adapters = runtime_wiring.WiringAdapters(
        prepare_session=lambda *_args: events.append("prepare"),  # type: ignore[arg-type]
        build_case_wiring=lambda *_args: events.append("cases"),  # type: ignore[arg-type]
        observe=lambda _expectations: events.append("observe"),  # type: ignore[arg-type]
        aggregate=lambda *_args: events.append("aggregate"),  # type: ignore[arg-type]
    )

    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="master_reservation_invalid"
    ):
        integrated_stage.build_master_reserved_stage_dependencies(
            master_context=context,
            repository_roots=repositories,
            external_roots=external,
            b1_wheel=wheel,
            pinned_python=python,
            pinned_python_sha256=hashlib.sha256(python.read_bytes()).hexdigest(),
            adapters=adapters,
            master_allowlist=runtime_wiring.TRACKED_ALLOWLIST,
        )

    assert events == []


def test_external_root_digest_is_ordered_and_bound() -> None:
    roots = tuple(
        _ExternalRoot(capability, Path(f"/tmp/{capability}"))
        for capability in reversed(integrated_stage.EXPECTED_EXTERNAL_CAPABILITIES)
    )
    with pytest.raises(integrated_stage.IntegratedStageFailure):
        integrated_stage.external_roots_digest(roots)


def test_core_binding_helpers_reject_unmapped_role_and_external_digest(
    tmp_path: Path,
) -> None:
    context, repositories, external, _wheel, _python = _fixture(tmp_path)

    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="repository_tuple_invalid"
    ):
        integrated_stage._role_repository("unknown")
    context.external_roots_sha256 = "f" * 64
    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="external_roots_invalid"
    ):
        integrated_stage._external_inputs(
            context, external, tuple(item.root for item in repositories)
        )


def test_external_inputs_allow_preserved_d2_evidence_but_require_clean_alert_roots(
    tmp_path: Path,
) -> None:
    context, repositories, external, _wheel, _python = _fixture(tmp_path)
    preserved = external[1].root / "postgres-public-receipt.json"
    preserved.write_text("public", encoding="utf-8")

    selected, digest = integrated_stage._external_inputs(
        context, external, tuple(item.root for item in repositories)
    )

    assert digest == context.external_roots_sha256
    assert selected.runtime_root == external[2].root
    assert preserved.read_text(encoding="utf-8") == "public"

    (external[3].root / "alert-residual").write_text("private", encoding="utf-8")
    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="external_roots_invalid"
    ):
        integrated_stage._external_inputs(
            context, external, tuple(item.root for item in repositories)
        )


def test_runtime_pin_checks_reject_wrong_wheel_name_mode_and_python_digest(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _context, _repositories, _external, wheel, python = _fixture(tmp_path)
    wheel_digest = hashlib.sha256(wheel.read_bytes()).hexdigest()
    monkeypatch.setattr(integrated_stage, "B1_WHEEL_SHA256", wheel_digest)
    wrong_name = wheel.with_name("wrong.whl")
    wrong_name.write_bytes(wheel.read_bytes())
    wrong_name.chmod(0o600)
    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="b1_wheel_invalid"
    ):
        integrated_stage._runtime_files(wrong_name, python, "f" * 64)

    python.chmod(0o600)
    with pytest.raises(integrated_stage.IntegratedStageFailure, match="python_invalid"):
        integrated_stage._runtime_files(wheel, python, "f" * 64)
    python.chmod(0o700)
    with pytest.raises(integrated_stage.IntegratedStageFailure, match="python_invalid"):
        integrated_stage._runtime_files(wheel, python, "f" * 64)


def test_master_union_allowlist_is_loaded_only_from_validated_suite_source() -> None:
    suite_root = Path(__file__).resolve().parents[4]

    allowlist = integrated_stage._load_master_allowlist(suite_root)

    assert tuple(allowlist) == admission.REPOSITORY_ROLES
    assert (
        "integration/compose/integrated-uat/src/"
        "cybrik_suite_integrated_uat/admission.py" in allowlist["suite"]
    )
    assert set(runtime_wiring.TRACKED_ALLOWLIST["soc"]).issubset(allowlist["soc"])


def _argv(context, repositories, external, wheel: Path, action: str) -> list[str]:
    values = [
        action,
        "--aggregate-sha256",
        context.aggregate_sha256,
        "--authorization-sha256",
        context.authorization_sha256,
        "--external-roots-sha256",
        context.external_roots_sha256,
        "--marker-sha256",
        context.marker_sha256,
        "--repository-roots-sha256",
        context.repository_roots_sha256,
        "--repository-tuple-sha256",
        context.repository_tuple_sha256,
        "--run-id",
        context.run_id,
        "--consumption-marker",
        str(context.consumption_marker),
        "--evidence-root",
        str(context.evidence_root),
        "--b1-wheel",
        str(wheel),
        "--pinned-python-sha256",
        "f" * 64,
    ]
    for item in repositories:
        values.extend(("--repository", f"{item.repository}={item.root}"))
    for item in context.repository_tuple:
        values.extend(
            (
                "--repository-identity",
                f"{item.repository}={item.commit}:{item.tree}",
            )
        )
    for item in external:
        values.extend(("--external-root", f"{item.capability}={item.root}"))
    return values


def test_cli_run_returns_only_master_bound_public_receipt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    context, repositories, external, wheel, _python = _fixture(tmp_path)
    binding = integrated_stage.ReservedRuntimeBinding(
        context.run_id,
        context.authorization_sha256,
        admission.TrackedBlobAggregate(
            admission.TRACKED_BLOB_ALGORITHM, 73, context.aggregate_sha256
        ),
        (),
    )
    dependencies = object()
    monkeypatch.setattr(
        integrated_stage,
        "build_master_reserved_stage_dependencies",
        lambda **_kwargs: integrated_stage.MasterReservedStageDependencies(
            binding,
            dependencies,
            context.external_roots_sha256,  # type: ignore[arg-type]
        ),
    )
    calls: list[tuple[object, object]] = []
    monkeypatch.setattr(
        integrated_stage.runtime_wiring,
        "run_reserved_stage",
        lambda deps, reservation: calls.append((deps, reservation)),
    )

    assert (
        integrated_stage.main(_argv(context, repositories, external, wheel, "run")) == 0
    )

    assert calls == [(dependencies, binding)]
    document = json.loads(capsys.readouterr().out)
    assert document == {
        "aggregate_sha256": context.aggregate_sha256,
        "external_roots_sha256": context.external_roots_sha256,
        "master_authorization_sha256": context.authorization_sha256,
        "master_marker_sha256": context.marker_sha256,
        "repository_roots_sha256": context.repository_roots_sha256,
        "repository_tuple_sha256": context.repository_tuple_sha256,
        "run_id": context.run_id,
        "schema": "cybrik.integrated-uat.public-stage-receipt/v1",
        "stage": "alert_context",
        "status": "passed",
    }


def test_cli_teardown_and_absence_are_non_consuming_and_separate(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    context, repositories, external, wheel, _python = _fixture(tmp_path)
    assert (
        integrated_stage.main(_argv(context, repositories, external, wheel, "teardown"))
        == 0
    )
    assert capsys.readouterr().out == ""
    assert (
        integrated_stage.main(
            _argv(context, repositories, external, wheel, "verify-absent")
        )
        == 0
    )
    document = json.loads(capsys.readouterr().out)
    assert document == {
        "absent": True,
        "aggregate_sha256": context.aggregate_sha256,
        "authorization_sha256": context.authorization_sha256,
        "external_roots_sha256": context.external_roots_sha256,
        "marker_sha256": context.marker_sha256,
        "repository_roots_sha256": context.repository_roots_sha256,
        "repository_tuple_sha256": context.repository_tuple_sha256,
        "run_id": context.run_id,
        "schema": "cybrik.integrated-uat.absence/v1",
        "scope": "alert_context",
    }


def test_cli_teardown_cleans_only_alert_roots_and_is_idempotent(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    context, repositories, external, wheel, _python = _fixture(tmp_path)
    d2_evidence = external[1].root / "postgres-public-receipt.json"
    d2_evidence.write_text("retain", encoding="utf-8")
    outside = tmp_path / "outside-private"
    outside.write_text("do-not-delete", encoding="utf-8")
    (external[2].root / "logs").mkdir()
    (external[2].root / "logs" / "soc.log").write_text("log", encoding="utf-8")
    (external[3].root / "private.json").write_text("private", encoding="utf-8")
    (external[4].root / "pki").mkdir()
    (external[4].root / "pki" / "private.pem").write_text("key", encoding="utf-8")
    (external[4].root / "outside-link").symlink_to(outside)

    teardown_argv = _argv(context, repositories, external, wheel, "teardown")
    assert integrated_stage.main(teardown_argv) == 0
    assert integrated_stage.main(teardown_argv) == 0

    assert capsys.readouterr().out == ""
    assert d2_evidence.read_text(encoding="utf-8") == "retain"
    assert outside.read_text(encoding="utf-8") == "do-not-delete"
    assert all(item.root.is_dir() for item in external)
    assert all(list(item.root.iterdir()) == [] for item in external[2:])
    assert (
        integrated_stage.main(
            _argv(context, repositories, external, wheel, "verify-absent")
        )
        == 0
    )
    assert json.loads(capsys.readouterr().out)["absent"] is True


def test_cli_teardown_attempts_every_alert_root_before_stable_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from cybrik_suite_uat_fabric import runtime_cleanup
    from cybrik_suite_uat_fabric.runtime_wiring_admission import (
        RuntimeAdmissionWiringError,
    )

    context, repositories, external, wheel, _python = _fixture(tmp_path)
    alert_roots = tuple(item.root for item in external[2:])
    for index, root in enumerate(alert_roots):
        (root / f"residual-{index}").write_text("private", encoding="utf-8")
    actual_clear = runtime_cleanup.clear_bound_root
    attempted: list[Path] = []

    def fail_evidence_root(root: Path) -> None:
        attempted.append(root)
        if root == alert_roots[1]:
            raise RuntimeAdmissionWiringError("runtime_cleanup_failed")
        actual_clear(root)

    monkeypatch.setattr(runtime_cleanup, "clear_bound_root", fail_evidence_root)

    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="stage_teardown_failed"
    ):
        integrated_stage.main(_argv(context, repositories, external, wheel, "teardown"))

    assert attempted == list(alert_roots)
    assert list(alert_roots[0].iterdir()) == []
    assert list(alert_roots[1].iterdir()) != []
    assert list(alert_roots[2].iterdir()) == []


def test_public_receipt_refuses_non_passed_child_status(tmp_path: Path) -> None:
    context, _repositories, _external, _wheel, _python = _fixture(tmp_path)

    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="stage_receipt_invalid"
    ):
        integrated_stage.public_receipt(
            context,
            external_roots_sha256=context.external_roots_sha256,
            status="failed",
        )


def test_verify_absent_rejects_remaining_runtime_root(tmp_path: Path) -> None:
    context, repositories, external, wheel, _python = _fixture(tmp_path)
    (external[2].root / "residual").write_text("x", encoding="utf-8")

    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="stage_residual_present"
    ):
        integrated_stage.main(
            _argv(context, repositories, external, wheel, "verify-absent")
        )


@pytest.mark.parametrize(
    "values",
    (
        ("known=first", "known=second"),
        (),
        ("unknown=value",),
    ),
)
def test_cli_binding_parser_rejects_duplicate_missing_or_unknown(values) -> None:
    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="binding_invalid"
    ):
        integrated_stage._parse_bindings(values, ("known",), "binding_invalid")


def test_verify_absent_rejects_state_residual(tmp_path: Path) -> None:
    context, repositories, external, wheel, _python = _fixture(tmp_path)
    (external[4].root / "unexpected").write_text("residual", encoding="ascii")

    with pytest.raises(
        integrated_stage.IntegratedStageFailure, match="stage_residual_present"
    ):
        integrated_stage.main(
            _argv(context, repositories, external, wheel, "verify-absent")
        )


def test_master_adapter_exact_argv_round_trips_through_fake_alert_cli(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    suite = Path(__file__).resolve().parents[4]
    integrated_source = suite / "integration/compose/integrated-uat/src"
    monkeypatch.syspath_prepend(str(integrated_source))
    adapters = importlib.import_module("cybrik_suite_integrated_uat.adapters")
    models = importlib.import_module("cybrik_suite_integrated_uat.models")
    repository_roots = tuple(
        models.RepositoryRoot(name, _directory(tmp_path / name))
        for name in models.EXPECTED_REPOSITORIES[:-1]
    ) + (models.RepositoryRoot("cybrik-suite", suite),)
    identities = tuple(
        models.RepositoryIdentity(name, f"{index:x}" * 40, f"{index + 4:x}" * 40, True)
        for index, name in enumerate(models.EXPECTED_REPOSITORIES, start=1)
    )
    external = tuple(
        models.ExternalRootBinding(capability, _directory(tmp_path / capability))
        for capability in models.EXPECTED_EXTERNAL_CAPABILITIES
    )
    evidence = _directory(tmp_path / "master-evidence")
    authorization = models.MasterAuthorization(
        aggregate_sha256="a" * 64,
        authorization_sha256="b" * 64,
        evidence_root=evidence,
        exact_head_grant_sha256="c" * 64,
        external_roots=external,
        external_roots_sha256=models.external_roots_digest(external),
        repository_roots=repository_roots,
        repository_roots_sha256=models.repository_roots_digest(repository_roots),
        repository_tuple=identities,
        repository_tuple_sha256=models.repository_tuple_digest(identities),
        run_id="adapter-alert-roundtrip-0001",
    )
    marker_document = {
        "aggregate_sha256": authorization.aggregate_sha256,
        "authorization_sha256": authorization.authorization_sha256,
        "exact_head_grant_sha256": authorization.exact_head_grant_sha256,
        "external_roots_sha256": authorization.external_roots_sha256,
        "one_shot": True,
        "repository_roots_sha256": authorization.repository_roots_sha256,
        "repository_tuple_sha256": authorization.repository_tuple_sha256,
        "run_id": authorization.run_id,
        "status": "consumed",
    }
    marker_payload = models.canonical_json_bytes(marker_document)
    marker = evidence / integrated_stage.MASTER_MARKER_NAME
    marker.write_bytes(marker_payload)
    marker.chmod(0o600)
    context = models.OrchestrationContext(
        aggregate_sha256=authorization.aggregate_sha256,
        authorization_sha256=authorization.authorization_sha256,
        consumption_marker=marker,
        evidence_root=evidence,
        external_roots_sha256=authorization.external_roots_sha256,
        marker_sha256=hashlib.sha256(marker_payload).hexdigest(),
        repository_tuple=identities,
        repository_tuple_sha256=authorization.repository_tuple_sha256,
        repository_roots_sha256=authorization.repository_roots_sha256,
        run_id=authorization.run_id,
    )
    wheel = tmp_path / runtime_wiring.B1_WHEEL_FILENAME
    wheel.write_bytes(b"adapter-wheel")
    wheel.chmod(0o600)
    script = suite / adapters.ALERT_CONTEXT_SCRIPT
    binding = integrated_stage.ReservedRuntimeBinding(
        context.run_id,
        context.authorization_sha256,
        admission.TrackedBlobAggregate(
            admission.TRACKED_BLOB_ALGORITHM, 1, context.aggregate_sha256
        ),
        (),
    )
    dependencies = object()
    monkeypatch.setattr(
        integrated_stage,
        "build_master_reserved_stage_dependencies",
        lambda **_kwargs: integrated_stage.MasterReservedStageDependencies(
            binding,
            dependencies,  # type: ignore[arg-type]
            context.external_roots_sha256,
        ),
    )
    monkeypatch.setattr(
        integrated_stage.runtime_wiring,
        "run_reserved_stage",
        lambda deps, reservation: (deps, reservation),
    )

    def executor(argv: tuple[str, ...], **_kwargs: object) -> object:
        assert argv[:4] == (
            str(Path(sys.executable).resolve()),
            "-B",
            "-P",
            str(script),
        )
        output = io.BytesIO()
        fake_stdout = SimpleNamespace(buffer=output)
        original = sys.stdout
        try:
            sys.stdout = fake_stdout  # type: ignore[assignment]
            returncode = integrated_stage.main(argv[4:])
        finally:
            sys.stdout = original
        return SimpleNamespace(
            returncode=returncode, stdout=output.getvalue(), stderr=b""
        )

    adapter = adapters.AlertContextStage(
        authorization=authorization,
        b1_wheel=wheel.resolve(),
        b1_wheel_sha256=hashlib.sha256(wheel.read_bytes()).hexdigest(),
        executor=executor,
        python_executable=Path(sys.executable).resolve(),
        python_sha256=hashlib.sha256(
            Path(sys.executable).resolve().read_bytes()
        ).hexdigest(),
        script_sha256=hashlib.sha256(script.read_bytes()).hexdigest(),
        suite_root=suite,
    )

    receipt = adapter.run(context)

    assert receipt.stage == "alert_context"
    assert receipt.aggregate_sha256 == context.aggregate_sha256
    assert receipt.repository_tuple_sha256 == context.repository_tuple_sha256
