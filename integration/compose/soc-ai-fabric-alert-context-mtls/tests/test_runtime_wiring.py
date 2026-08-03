from __future__ import annotations

import stat
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_fabric import admission, runtime_case_wiring, runtime_wiring


def _directory(path: Path) -> Path:
    path.mkdir(parents=True, mode=0o700)
    path.chmod(0o700)
    return path.resolve()


@dataclass
class _Supervisor:
    events: list[str]
    owned_roles: tuple[str, ...] = ()

    def start_role(self, role: str) -> None:
        self.events.append(f"supervisor:start:{role}")
        self.owned_roles = (*self.owned_roles, role)

    def stop_role(self, role: str) -> None:
        self.events.append(f"supervisor:stop:{role}")
        self.owned_roles = tuple(
            owned_role for owned_role in self.owned_roles if owned_role != role
        )


def test_session_maps_exact_runner_handles_to_role_wise_supervisor_order(
    tmp_path: Path,
) -> None:
    events: list[str] = []
    supervisor = _Supervisor(events)
    session = runtime_wiring.RuntimeSession(
        supervisor=supervisor,
        cleanup=lambda: events.append("cleanup"),
        absence_probe=lambda: {
            key: True for key in runtime_wiring.runner.REQUIRED_ABSENCE_CHECKS
        },
    )

    soc = session.start("soc")
    fabric = session.start("fabric")
    ai = session.start("ai")
    session.wait_ready(soc)
    session.wait_ready(fabric)
    session.wait_ready(ai)
    session.stop(ai)
    session.stop(fabric)
    session.stop(soc)
    session.finalize()

    assert events == [
        "supervisor:start:soc",
        "supervisor:start:fabric",
        "supervisor:start:ai",
        "supervisor:stop:ai",
        "supervisor:stop:fabric",
        "supervisor:stop:soc",
        "cleanup",
    ]
    assert session.verify_absent() == {
        key: True for key in runtime_wiring.runner.REQUIRED_ABSENCE_CHECKS
    }


def test_secure_receipt_filesystem_is_write_once_mode_0600_and_durable(
    tmp_path: Path,
) -> None:
    root = _directory(tmp_path / "receipts")
    filesystem = runtime_wiring.SecureReceiptFileSystem(root)

    filesystem.write_once("ready-01-soc.json", b"{}")

    path = root / "ready-01-soc.json"
    assert path.read_bytes() == b"{}"
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    with pytest.raises(runtime_wiring.RuntimeWiringError, match="receipt_write_failed"):
        filesystem.write_once("ready-01-soc.json", b"replacement")


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


def test_bootstrap_wiring_adapts_exact_admission_session_cases_and_consumption(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repositories = runtime_wiring.RepositoryLayout(
        suite=_directory(tmp_path / "suite"),
        soc=_directory(tmp_path / "soc"),
        cyber_ai=_directory(tmp_path / "ai"),
        tool_fabric=_directory(tmp_path / "fabric"),
        soc_source=_directory(tmp_path / "soc/src"),
        cyber_ai_api_source=_directory(tmp_path / "ai/api"),
        cyber_ai_core_source=_directory(tmp_path / "ai/core"),
        tool_fabric_source=_directory(tmp_path / "fabric/src"),
    )
    external = runtime_wiring.ExternalRoots(
        runtime_root=_directory(tmp_path / "external/runtime"),
        evidence_root=_directory(tmp_path / "external/evidence"),
        state_root=_directory(tmp_path / "external/state"),
    )
    config = SimpleNamespace(
        repositories=repositories,
        external=external,
        authorization_file=tmp_path / "authorization.json",
        signature_file=tmp_path / "authorization.sig",
        allowed_signer="FOUNDER",
    )
    expectations = tuple(
        admission.RepoExpectation(role, root, character * 40, character * 40)
        for role, root, character in zip(
            admission.REPOSITORY_ROLES, repositories.roots, "abcd", strict=True
        )
    )
    intent = runtime_wiring.SignedIntent(expectations, b"authorization", b"signature")
    observations = tuple(
        admission.RepositoryObservation(item.role, item.root, item.commit, item.tree)
        for item in expectations
    )
    aggregate = admission.TrackedBlobAggregate("test", 1, "e" * 64)
    now = datetime.now(UTC)
    authorization = admission.ExternalAuthorization(
        authorization_id="attempt-1",
        authorized_by="FOUNDER",
        authorization_sha256="f" * 64,
        exact=True,
        external=True,
        one_shot=True,
        consumed=False,
        issued_at=now - timedelta(minutes=1),
        expires_at=now + timedelta(minutes=1),
        aggregate=aggregate,
        observations=observations,
    )
    events: list[str] = []
    session = runtime_wiring.RuntimeSession(
        supervisor=_Supervisor(events),
        cleanup=lambda: events.append("cleanup"),
        absence_probe=lambda: {
            key: True for key in runtime_wiring.runner.REQUIRED_ABSENCE_CHECKS
        },
    )
    journal = _directory(tmp_path / "journal")
    (journal / "receipt.json").write_text("{}", encoding="utf-8")
    case_wiring = runtime_case_wiring.RuntimeCaseWiring(
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
            [_Response(200, {"model_calls": 1}), _Response(200, {"model_calls": 1})]
        ),
        positive_request={"request_id": "sum-1"},
        f1_request={"idempotency_key": "idem-f1-actor-mismatch-0001"},
        journal_root=journal,
        scratch_root=tmp_path / "scratch",
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
    consumed: list[object] = []
    monkeypatch.setattr(runtime_wiring, "load_runtime_environment", lambda _env: config)
    monkeypatch.setattr(runtime_wiring, "verify_signed_intent", lambda _config: intent)
    monkeypatch.setattr(
        runtime_wiring.admission,
        "admit_external_authorization",
        lambda **_kwargs: authorization,
    )
    monkeypatch.setattr(
        runtime_wiring.admission,
        "consume_once",
        lambda admitted, **_kwargs: consumed.append(admitted),
    )
    adapters = runtime_wiring.WiringAdapters(
        prepare_session=lambda _config, _authorization: session,
        build_case_wiring=lambda _config, _authorization, _session: case_wiring,
        now=lambda: now,
        observe=lambda _expectations: observations,
        aggregate=lambda _observations, _allowlist: aggregate,
    )
    dependencies = runtime_wiring.build_bootstrap_dependencies({}, adapters=adapters)

    observed_intent = dependencies.verify_signed_intent()
    observed_tuple = dependencies.observe_exact_tuple(observed_intent)
    observed_aggregate = dependencies.calculate_aggregate(
        observed_intent, observed_tuple
    )
    admitted = dependencies.bind_authorization(
        observed_intent, observed_tuple, observed_aggregate
    )
    roots = dependencies.validate_external_roots(admitted)
    prepared = dependencies.prepare_runtime(admitted, roots)
    runner = dependencies.build_runner_dependencies(admitted, roots, prepared)
    soc = runner.start_soc(admitted)
    runner.wait_soc_ready(soc)
    fabric = runner.start_fabric(admitted)
    runner.wait_fabric_ready(fabric)
    ai = runner.start_ai(admitted)
    runner.wait_ai_ready(ai)
    assert runner.run_positive(admitted)["passed"] is True
    assert runner.run_f1(admitted)["passed"] is True
    assert runner.run_f2(admitted)["passed"] is True
    runner.stop_ai(ai)
    runner.stop_fabric(fabric)
    runner.stop_soc(soc)
    runner.finalize_runtime(admitted)
    assert all(runner.verify_absent(admitted).values())
    runner.consume_authorization(admitted, "0" * 64)
    assert runner.evidence_root_for(admitted) == external.evidence_root
    assert consumed == [authorization]


def test_concrete_case_factory_binds_fixed_f1_positive_durability_and_empty_copy(
    tmp_path: Path,
) -> None:
    roots = SimpleNamespace(
        soc_source=Path("/tmp/soc"),
        cyber_ai_api_source=Path("/tmp/ai-api"),
        cyber_ai_core_source=Path("/tmp/ai-core"),
        tool_fabric_source=Path("/tmp/fabric"),
    )
    positive = _Client([_Response(200, {"outcome": "completed"})])
    journal = _directory(tmp_path / "journal")
    (journal / "durable.json").write_text("{}", encoding="utf-8")
    context = runtime_wiring.RuntimeProcessContext(
        config=object(),
        authorization=object(),  # type: ignore[arg-type]
        pki=object(),
        settings=object(),
        config_path=tmp_path / "config.json",
        journal_root=journal,
        scratch_root=tmp_path / "scratch",
        receipt_key=tmp_path / "key.pem",
        handles={},
        closers=[],
        clients={"ai": positive, "fabric": _Client([]), "soc": _Client([])},  # type: ignore[dict-item]
    )
    session = runtime_wiring.RuntimeSession(
        supervisor=_Supervisor([]),
        cleanup=lambda: None,
        absence_probe=dict,
        runtime_context=context,
    )

    wiring = runtime_wiring._build_concrete_cases(
        SimpleNamespace(repositories=roots),  # type: ignore[arg-type]
        object(),  # type: ignore[arg-type]
        session,
    )
    response = wiring.positive_client.post(
        "/uat/v1/summarizations", json=wiring.positive_request
    )

    assert response.status_code == 200
    assert wiring.authoritative_receipt_probe() == {
        "receipt_verified": True,
        "durable_receipt": True,
        "side_effect_performed": False,
    }
    assert wiring.f1_request["actor"] == {
        "type": "agent",
        "id": "body-selected-actor",
        "tenant_id": "tenant-acme",
    }
    empty_copy = _directory(tmp_path / "empty-copy")
    assert wiring.copied_receipt_tamper_probe(empty_copy) == {
        "disposition": "not_durable",
        "receipt": None,
    }


def test_bootstrap_wiring_invalid_types_and_nonempty_root_fail_before_effect(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repositories = SimpleNamespace(roots=())
    external = runtime_wiring.ExternalRoots(
        _directory(tmp_path / "runtime"),
        _directory(tmp_path / "evidence"),
        _directory(tmp_path / "state"),
    )
    config = SimpleNamespace(
        repositories=repositories,
        external=external,
        allowed_signer="FOUNDER",
        authorization_file=tmp_path / "auth",
        signature_file=tmp_path / "sig",
    )
    monkeypatch.setattr(runtime_wiring, "load_runtime_environment", lambda _env: config)
    dependencies = runtime_wiring.build_bootstrap_dependencies(
        {},
        adapters=runtime_wiring.WiringAdapters(
            prepare_session=lambda *_args: None,  # type: ignore[arg-type]
            build_case_wiring=lambda *_args: None,  # type: ignore[arg-type]
        ),
    )

    for callback, arguments in (
        (dependencies.observe_exact_tuple, (object(),)),
        (dependencies.calculate_aggregate, (object(), object())),
        (dependencies.bind_authorization, (object(), object(), object())),
        (dependencies.prepare_runtime, (object(), external)),
        (dependencies.build_runner_dependencies, (object(), external, object())),
    ):
        with pytest.raises(runtime_wiring.RuntimeWiringError):
            callback(*arguments)

    (external.runtime_root / "unexpected").write_text("x", encoding="utf-8")
    with pytest.raises(
        runtime_wiring.RuntimeWiringError, match="external_root_not_empty"
    ):
        dependencies.validate_external_roots(
            SimpleNamespace(authorization_id="attempt-invalid")
        )


def test_reserved_stage_never_authorizes_consumes_or_writes_child_terminal() -> None:
    events: list[str] = []

    def start(role: str) -> object:
        events.append(f"start:{role}")
        return role

    def stop(handle: object) -> None:
        events.append(f"stop:{handle}")

    dependencies = runtime_wiring.runner.RunnerDependencies(
        authorize=lambda: (_ for _ in ()).throw(
            AssertionError("child authorize called")
        ),
        start_soc=lambda _reservation: start("soc"),
        wait_soc_ready=lambda handle: events.append(f"ready:{handle}"),
        start_fabric=lambda _reservation: start("fabric"),
        wait_fabric_ready=lambda handle: events.append(f"ready:{handle}"),
        start_ai=lambda _reservation: start("ai"),
        wait_ai_ready=lambda handle: events.append(f"ready:{handle}"),
        run_positive=lambda _reservation: {"case_id": "positive", "passed": True},
        run_f1=lambda _reservation: {"case_id": "F1", "passed": True},
        run_f2=lambda _reservation: {"case_id": "F2", "passed": True},
        stop_ai=stop,
        stop_fabric=stop,
        stop_soc=stop,
        verify_absent=lambda _reservation: {
            key: True for key in runtime_wiring.runner.REQUIRED_ABSENCE_CHECKS
        },
        consume_authorization=lambda *_args: (_ for _ in ()).throw(
            AssertionError("child consume called")
        ),
        finalize_runtime=lambda _reservation: events.append("finalize"),
        evidence_root_for=lambda _reservation: (_ for _ in ()).throw(
            AssertionError("child evidence root requested")
        ),
    )

    result = runtime_wiring.run_reserved_stage(
        dependencies, SimpleNamespace(reservation_id="master-1")
    )

    assert tuple(item["case_id"] for item in result.cases) == (
        "positive",
        "F1",
        "F2",
    )
    assert all(result.absence.values())
    assert events == [
        "start:soc",
        "ready:soc",
        "start:fabric",
        "ready:fabric",
        "start:ai",
        "ready:ai",
        "stop:ai",
        "stop:fabric",
        "stop:soc",
        "finalize",
    ]
