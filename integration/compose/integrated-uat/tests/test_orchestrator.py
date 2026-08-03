from __future__ import annotations

import json
import os
from dataclasses import replace
from pathlib import Path

import pytest

from cybrik_suite_integrated_uat import (
    CONSUMPTION_MARKER,
    EXPECTED_PORTS,
    EXPECTED_REPOSITORIES,
    TERMINAL_SEAL,
    EnvironmentSnapshot,
    IntegratedUatOrchestrator,
    MasterAuthorization,
    OrchestrationContext,
    OrchestrationFailure,
    RepositoryIdentity,
    StageReceipt,
    absence_proof_digest,
    repository_tuple_digest,
    storage,
)
from cybrik_suite_integrated_uat.models import (
    EXPECTED_EXTERNAL_CAPABILITIES,
    ExternalRootBinding,
    RepositoryRoot,
    external_roots_digest,
    repository_roots_digest,
)

AGGREGATE = "a" * 64
AUTHORIZATION_DIGEST = "b" * 64
GRANT_DIGEST = "c" * 64
D2_DIGEST = "d" * 64
ALERT_DIGEST = "e" * 64


def repositories(*, clean: bool = True) -> tuple[RepositoryIdentity, ...]:
    return tuple(
        RepositoryIdentity(
            repository=name,
            commit=f"{index + 1:x}" * 40,
            tree=f"{index + 5:x}" * 40,
            clean=clean,
        )
        for index, name in enumerate(EXPECTED_REPOSITORIES)
    )


def authorization(tmp_path: Path) -> MasterAuthorization:
    evidence_root = tmp_path / "evidence"
    evidence_root.mkdir(mode=0o700)
    repository_roots = tuple(
        RepositoryRoot(
            repository=name,
            root=tmp_path / "repositories" / name,
        )
        for name in EXPECTED_REPOSITORIES
    )
    for repository_root in repository_roots:
        repository_root.root.mkdir(parents=True)
    external_roots = tuple(
        ExternalRootBinding(
            capability=capability,
            root=tmp_path / "external" / capability,
        )
        for capability in EXPECTED_EXTERNAL_CAPABILITIES
    )
    for external_root in external_roots:
        external_root.root.mkdir(parents=True, mode=0o700)
    identities = repositories()
    return MasterAuthorization(
        aggregate_sha256=AGGREGATE,
        authorization_sha256=AUTHORIZATION_DIGEST,
        evidence_root=evidence_root,
        exact_head_grant_sha256=GRANT_DIGEST,
        external_roots=external_roots,
        external_roots_sha256=external_roots_digest(external_roots),
        repository_roots=repository_roots,
        repository_roots_sha256=repository_roots_digest(repository_roots),
        repository_tuple=identities,
        repository_tuple_sha256=repository_tuple_digest(identities),
        run_id="integrated-uat-0001",
    )


def snapshot(
    auth: MasterAuthorization,
    *,
    aggregate: str | None = None,
    ports: tuple[int, ...] = EXPECTED_PORTS,
    repos: tuple[RepositoryIdentity, ...] | None = None,
) -> EnvironmentSnapshot:
    return EnvironmentSnapshot(
        absent_ports=ports,
        aggregate_sha256=aggregate or auth.aggregate_sha256,
        pki_absent=True,
        postgres_absent=True,
        private_artifacts_absent=True,
        processes_absent=True,
        external_roots_sha256=auth.external_roots_sha256,
        repository_roots_sha256=auth.repository_roots_sha256,
        repository_tuple=repos or auth.repository_tuple,
        repository_tuple_sha256=auth.repository_tuple_sha256,
        runtime_artifacts_absent=True,
    )


def receipt(auth: MasterAuthorization, *, stage: str, digest: str) -> StageReceipt:
    return StageReceipt(
        aggregate_sha256=auth.aggregate_sha256,
        receipt_sha256=digest,
        repository_tuple_sha256=auth.repository_tuple_sha256,
        stage=stage,
    )


class RecordingStage:
    def __init__(
        self,
        *,
        name: str,
        result: StageReceipt,
        events: list[str],
        fail_run: bool = False,
        fail_teardown: bool = False,
        fail_verify: bool = False,
    ) -> None:
        self.name = name
        self.result = result
        self.events = events
        self.fail_run = fail_run
        self.fail_teardown = fail_teardown
        self.fail_verify = fail_verify

    def run(self, context: OrchestrationContext) -> StageReceipt:
        assert context.consumption_marker.is_file()
        reservation = json.loads(
            (context.evidence_root / TERMINAL_SEAL).read_text(encoding="utf-8")
        )
        assert reservation["status"] == "reserved_interrupted"
        assert reservation["marker_sha256"] == context.marker_sha256
        self.events.append(f"{self.name}.run")
        if self.fail_run:
            raise RuntimeError("synthetic stage failure")
        return self.result

    def teardown(self, context: OrchestrationContext) -> None:
        assert context.consumption_marker.is_file()
        self.events.append(f"{self.name}.teardown")
        if self.fail_teardown:
            raise RuntimeError("synthetic teardown failure")

    def verify_absent(self, context: OrchestrationContext) -> None:
        self.events.append(f"{self.name}.verify_absent")
        if self.fail_verify:
            raise RuntimeError("synthetic absence failure")


class RecordingCommonTeardown:
    def __init__(
        self,
        events: list[str],
        *,
        fail_teardown: bool = False,
        fail_verify: bool = False,
    ) -> None:
        self.events = events
        self.fail_teardown = fail_teardown
        self.fail_verify = fail_verify

    def teardown(self, context: OrchestrationContext) -> None:
        self.events.append("common.teardown")
        if self.fail_teardown:
            raise RuntimeError("synthetic common teardown failure")

    def verify_absent(self, context: OrchestrationContext) -> None:
        self.events.append("common.verify_absent")
        if self.fail_verify:
            raise RuntimeError("synthetic common absence failure")


class RecordingInspector:
    def __init__(
        self, snapshots: tuple[EnvironmentSnapshot, ...], events: list[str]
    ) -> None:
        self.snapshots = snapshots
        self.events = events
        self.index = 0

    def inspect(self) -> EnvironmentSnapshot:
        phase = "preflight" if self.index == 0 else "terminal"
        self.events.append(f"inspect.{phase}")
        result = self.snapshots[self.index]
        self.index += 1
        return result


def orchestrator(
    auth: MasterAuthorization,
    events: list[str],
    *,
    d2: RecordingStage | None = None,
    alert: RecordingStage | None = None,
    common: RecordingCommonTeardown | None = None,
    snapshots: tuple[EnvironmentSnapshot, ...] | None = None,
) -> IntegratedUatOrchestrator:
    return IntegratedUatOrchestrator(
        alert_context_stage=alert
        or RecordingStage(
            name="alert",
            result=receipt(auth, stage="alert_context", digest=ALERT_DIGEST),
            events=events,
        ),
        common_teardown=common or RecordingCommonTeardown(events),
        environment_inspector=RecordingInspector(
            snapshots or (snapshot(auth), snapshot(auth)), events
        ),
        postgres_d2_stage=d2
        or RecordingStage(
            name="d2",
            result=receipt(auth, stage="postgres_d2", digest=D2_DIGEST),
            events=events,
        ),
    )


def test_success_consumes_once_orders_stages_and_emits_one_combined_seal(
    tmp_path: Path,
) -> None:
    auth = authorization(tmp_path)
    events: list[str] = []

    seal = orchestrator(auth, events).run(auth)

    assert events == [
        "inspect.preflight",
        "d2.run",
        "d2.teardown",
        "d2.verify_absent",
        "alert.run",
        "alert.teardown",
        "alert.verify_absent",
        "common.teardown",
        "common.verify_absent",
        "inspect.terminal",
    ]
    assert seal.postgres_d2_receipt_sha256 == D2_DIGEST
    assert seal.alert_context_receipt_sha256 == ALERT_DIGEST
    assert seal.aggregate_sha256 == AGGREGATE
    assert seal.repository_tuple_sha256 == auth.repository_tuple_sha256
    assert seal.status == "sealed"
    assert seal.failure_code is None
    assert seal.terminal_absence_proof_sha256 == absence_proof_digest(snapshot(auth))
    marker = auth.evidence_root / CONSUMPTION_MARKER
    seal_path = auth.evidence_root / TERMINAL_SEAL
    assert marker.is_file() and seal_path.is_file()
    assert sorted(path.name for path in auth.evidence_root.iterdir()) == sorted(
        (CONSUMPTION_MARKER, TERMINAL_SEAL)
    )
    assert json.loads(seal_path.read_text(encoding="utf-8")) == seal.to_dict()


def test_marker_is_bound_and_exists_before_the_first_stage_effect(
    tmp_path: Path,
) -> None:
    auth = authorization(tmp_path)
    orchestrator(auth, []).run(auth)

    marker = json.loads(
        (auth.evidence_root / CONSUMPTION_MARKER).read_text(encoding="utf-8")
    )
    assert marker == {
        "aggregate_sha256": auth.aggregate_sha256,
        "authorization_sha256": auth.authorization_sha256,
        "exact_head_grant_sha256": auth.exact_head_grant_sha256,
        "external_roots_sha256": auth.external_roots_sha256,
        "one_shot": True,
        "repository_roots_sha256": auth.repository_roots_sha256,
        "repository_tuple_sha256": auth.repository_tuple_sha256,
        "run_id": auth.run_id,
        "status": "consumed",
    }


def test_second_attempt_is_terminal_and_runs_no_effect(tmp_path: Path) -> None:
    auth = authorization(tmp_path)
    events: list[str] = []
    subject = orchestrator(auth, events)
    subject.run(auth)
    before = tuple(events)

    with pytest.raises(OrchestrationFailure, match="^authorization_already_consumed$"):
        subject.run(auth)

    assert tuple(events) == before


@pytest.mark.parametrize(
    ("mutate", "reason"),
    (
        pytest.param(
            lambda auth: replace(auth, aggregate_sha256="f" * 64),
            "authorization_aggregate_mismatch",
            id="aggregate",
        ),
        pytest.param(
            lambda auth: replace(
                auth, repository_tuple=tuple(reversed(auth.repository_tuple))
            ),
            "authorization_repository_tuple_invalid",
            id="repository-order",
        ),
        pytest.param(
            lambda auth: replace(
                auth,
                repository_tuple=tuple(
                    replace(item, clean=False)
                    if item.repository == "cybrik-suite"
                    else item
                    for item in auth.repository_tuple
                ),
            ),
            "authorization_repository_not_clean",
            id="dirty-repository",
        ),
    ),
)
def test_invalid_master_authorization_fails_before_consumption_or_stage_effects(
    tmp_path: Path, mutate: object, reason: str
) -> None:
    auth = authorization(tmp_path)
    invalid = mutate(auth)
    events: list[str] = []

    with pytest.raises(OrchestrationFailure, match=f"^{reason}$"):
        orchestrator(auth, events).run(invalid)

    assert not any(".run" in event for event in events)
    assert not (auth.evidence_root / CONSUMPTION_MARKER).exists()


@pytest.mark.parametrize(
    ("terminal", "reason"),
    (
        pytest.param(
            lambda auth: snapshot(auth, aggregate="f" * 64),
            "environment_aggregate_mismatch",
            id="aggregate",
        ),
        pytest.param(
            lambda auth: snapshot(auth, ports=EXPECTED_PORTS[:-1]),
            "environment_ports_not_absent",
            id="ports",
        ),
        pytest.param(
            lambda auth: replace(snapshot(auth), repository_roots_sha256="f" * 64),
            "environment_repository_roots_mismatch",
            id="repository-roots",
        ),
        pytest.param(
            lambda auth: replace(snapshot(auth), external_roots_sha256="f" * 64),
            "environment_external_roots_mismatch",
            id="external-roots",
        ),
        pytest.param(
            lambda auth: snapshot(
                auth,
                repos=tuple(
                    replace(item, clean=False)
                    if item.repository == "cybrik-suite"
                    else item
                    for item in auth.repository_tuple
                ),
            ),
            "environment_repository_not_clean",
            id="dirty-repository",
        ),
    ),
)
def test_terminal_environment_drift_writes_a_failure_seal_and_consumes_the_attempt(
    tmp_path: Path, terminal: object, reason: str
) -> None:
    auth = authorization(tmp_path)
    events: list[str] = []

    with pytest.raises(OrchestrationFailure, match=f"^{reason}$"):
        orchestrator(auth, events, snapshots=(snapshot(auth), terminal(auth))).run(auth)

    assert (auth.evidence_root / CONSUMPTION_MARKER).is_file()
    stored = json.loads((auth.evidence_root / TERMINAL_SEAL).read_text())
    assert stored["status"] == "failed"
    assert stored["failure_code"] == reason
    assert events[-1] == "inspect.terminal"


@pytest.mark.parametrize(
    ("receipt_mutation", "reason"),
    (
        pytest.param(
            lambda item: replace(item, aggregate_sha256="f" * 64),
            "stage_receipt_aggregate_mismatch",
            id="aggregate",
        ),
        pytest.param(
            lambda item: replace(item, repository_tuple_sha256="f" * 64),
            "stage_receipt_repository_tuple_mismatch",
            id="tuple",
        ),
        pytest.param(
            lambda item: replace(item, stage="alert_context"),
            "stage_receipt_identity_mismatch",
            id="stage",
        ),
        pytest.param(
            lambda item: replace(item, receipt_sha256="not-a-digest"),
            "stage_receipt_digest_invalid",
            id="digest",
        ),
    ),
)
def test_unbound_d2_receipt_is_terminal_but_still_cleans_everything(
    tmp_path: Path, receipt_mutation: object, reason: str
) -> None:
    auth = authorization(tmp_path)
    events: list[str] = []
    invalid = receipt_mutation(receipt(auth, stage="postgres_d2", digest=D2_DIGEST))

    with pytest.raises(OrchestrationFailure, match=f"^{reason}$"):
        orchestrator(
            auth, events, d2=RecordingStage(name="d2", result=invalid, events=events)
        ).run(auth)

    assert events == [
        "inspect.preflight",
        "d2.run",
        "d2.teardown",
        "d2.verify_absent",
        "common.teardown",
        "common.verify_absent",
        "inspect.terminal",
    ]
    stored = json.loads((auth.evidence_root / TERMINAL_SEAL).read_text())
    assert stored["status"] == "failed"
    assert stored["failure_code"] == reason
    assert stored["postgres_d2_receipt_sha256"] is None
    assert stored["alert_context_receipt_sha256"] is None


@pytest.mark.parametrize(
    ("stage_name", "reason"),
    (
        ("d2", "postgres_d2_stage_failed"),
        ("alert", "alert_context_stage_failed"),
    ),
)
def test_partial_stage_failure_is_cleaned_and_never_retried(
    tmp_path: Path, stage_name: str, reason: str
) -> None:
    auth = authorization(tmp_path)
    events: list[str] = []
    failing = RecordingStage(
        name=stage_name,
        result=receipt(
            auth,
            stage="postgres_d2" if stage_name == "d2" else "alert_context",
            digest=D2_DIGEST if stage_name == "d2" else ALERT_DIGEST,
        ),
        events=events,
        fail_run=True,
    )
    subject = orchestrator(
        auth,
        events,
        d2=failing if stage_name == "d2" else None,
        alert=failing if stage_name == "alert" else None,
    )

    with pytest.raises(OrchestrationFailure, match=f"^{reason}$"):
        subject.run(auth)

    assert f"{stage_name}.teardown" in events
    assert f"{stage_name}.verify_absent" in events
    assert events[-3:] == [
        "common.teardown",
        "common.verify_absent",
        "inspect.terminal",
    ]
    before = tuple(events)
    with pytest.raises(OrchestrationFailure, match="^authorization_already_consumed$"):
        subject.run(auth)
    assert tuple(events) == before
    if stage_name == "d2":
        assert "alert.run" not in events
    stored = json.loads((auth.evidence_root / TERMINAL_SEAL).read_text())
    assert stored["status"] == "failed"
    assert stored["failure_code"] == reason
    assert stored["postgres_d2_receipt_sha256"] == (
        D2_DIGEST if stage_name == "alert" else None
    )
    assert stored["alert_context_receipt_sha256"] is None


def test_d2_teardown_failure_prevents_alert_but_common_cleanup_still_runs(
    tmp_path: Path,
) -> None:
    auth = authorization(tmp_path)
    events: list[str] = []
    d2 = RecordingStage(
        name="d2",
        result=receipt(auth, stage="postgres_d2", digest=D2_DIGEST),
        events=events,
        fail_teardown=True,
    )

    with pytest.raises(OrchestrationFailure, match="^postgres_d2_cleanup_failed$"):
        orchestrator(auth, events, d2=d2).run(auth)

    assert "alert.run" not in events
    assert events[-3:] == [
        "common.teardown",
        "common.verify_absent",
        "inspect.terminal",
    ]


def test_common_teardown_and_absence_failures_are_both_attempted(
    tmp_path: Path,
) -> None:
    auth = authorization(tmp_path)
    events: list[str] = []
    common = RecordingCommonTeardown(events, fail_teardown=True, fail_verify=True)

    with pytest.raises(OrchestrationFailure, match="^common_teardown_failed$"):
        orchestrator(auth, events, common=common).run(auth)

    assert events[-3:] == [
        "common.teardown",
        "common.verify_absent",
        "inspect.terminal",
    ]
    stored = json.loads((auth.evidence_root / TERMINAL_SEAL).read_text())
    assert stored["failure_code"] == "common_teardown_failed"


def test_evidence_root_is_private_canonical_and_outside_repository_roots(
    tmp_path: Path,
) -> None:
    auth = authorization(tmp_path)
    auth.evidence_root.chmod(0o755)
    with pytest.raises(OrchestrationFailure, match="^evidence_root_invalid$"):
        orchestrator(auth, []).run(auth)

    auth.evidence_root.chmod(0o700)
    inside = auth.repository_roots[0].root / "evidence"
    inside.mkdir(mode=0o700)
    invalid = replace(auth, evidence_root=inside)
    with pytest.raises(OrchestrationFailure, match="^evidence_root_inside_repository$"):
        orchestrator(invalid, []).run(invalid)

    outer_evidence = tmp_path / "outer-evidence"
    outer_evidence.mkdir(mode=0o700)
    nested_repository = outer_evidence / EXPECTED_REPOSITORIES[0]
    nested_repository.mkdir()
    nested_roots = (
        replace(auth.repository_roots[0], root=nested_repository),
        *auth.repository_roots[1:],
    )
    invalid = replace(
        auth,
        evidence_root=outer_evidence,
        repository_roots=nested_roots,
        repository_roots_sha256=repository_roots_digest(nested_roots),
    )
    with pytest.raises(OrchestrationFailure, match="^repository_root_inside_evidence$"):
        orchestrator(invalid, []).run(invalid)


def test_evidence_root_must_be_empty_before_consumption(tmp_path: Path) -> None:
    auth = authorization(tmp_path)
    (auth.evidence_root / "unexpected").write_text("occupied", encoding="utf-8")

    with pytest.raises(OrchestrationFailure, match="^evidence_root_not_empty$"):
        orchestrator(auth, []).run(auth)


@pytest.mark.parametrize("root_kind", ("missing", "file"))
def test_repository_root_must_be_an_existing_canonical_directory(
    tmp_path: Path, root_kind: str
) -> None:
    auth = authorization(tmp_path)
    invalid_root = tmp_path / f"invalid-{root_kind}"
    if root_kind == "file":
        invalid_root.write_text("not a repository directory", encoding="utf-8")
    roots = (
        replace(auth.repository_roots[0], root=invalid_root),
        *auth.repository_roots[1:],
    )
    invalid = replace(
        auth,
        repository_roots=roots,
        repository_roots_sha256=repository_roots_digest(roots),
    )

    with pytest.raises(OrchestrationFailure, match="^repository_root_invalid$"):
        orchestrator(invalid, []).run(invalid)


def test_preexisting_terminalization_pending_file_blocks_attempt(
    tmp_path: Path,
) -> None:
    auth = authorization(tmp_path)
    pending = auth.evidence_root / storage.PENDING_TERMINAL_SEAL
    pending.write_text("occupied", encoding="utf-8")

    with pytest.raises(OrchestrationFailure, match="^terminalization_in_progress$"):
        orchestrator(auth, []).run(auth)


def test_repository_roots_are_name_bound_and_canonical_unique(tmp_path: Path) -> None:
    auth = authorization(tmp_path)
    untyped = replace(
        auth,
        repository_roots=tuple(root.root for root in auth.repository_roots),
    )
    with pytest.raises(
        OrchestrationFailure, match="^authorization_repository_roots_invalid$"
    ):
        orchestrator(untyped, []).run(untyped)

    substituted = replace(
        auth,
        repository_roots=(
            replace(auth.repository_roots[0], repository="cybrik-suite"),
            *auth.repository_roots[1:],
        ),
    )

    with pytest.raises(
        OrchestrationFailure, match="^authorization_repository_roots_invalid$"
    ):
        orchestrator(substituted, []).run(substituted)

    duplicated_roots = (
        auth.repository_roots[0],
        replace(auth.repository_roots[1], root=auth.repository_roots[0].root),
        *auth.repository_roots[2:],
    )
    duplicated = replace(
        auth,
        repository_roots=duplicated_roots,
        repository_roots_sha256=repository_roots_digest(duplicated_roots),
    )
    with pytest.raises(OrchestrationFailure, match="^repository_root_duplicate$"):
        orchestrator(duplicated, []).run(duplicated)


def test_external_roots_are_exact_ordered_unique_private_empty_and_disjoint(
    tmp_path: Path,
) -> None:
    auth = authorization(tmp_path)
    substituted = replace(auth.external_roots[0], capability="alert_context_state")
    invalid_order = (substituted, *auth.external_roots[1:])
    invalid = replace(
        auth,
        external_roots=invalid_order,
        external_roots_sha256=external_roots_digest(invalid_order),
    )
    with pytest.raises(
        OrchestrationFailure, match="^authorization_external_roots_invalid$"
    ):
        orchestrator(invalid, []).run(invalid)

    duplicate_roots = (
        auth.external_roots[0],
        replace(auth.external_roots[1], root=auth.external_roots[0].root),
        *auth.external_roots[2:],
    )
    duplicate = replace(
        auth,
        external_roots=duplicate_roots,
        external_roots_sha256=external_roots_digest(duplicate_roots),
    )
    with pytest.raises(OrchestrationFailure, match="^external_root_duplicate$"):
        orchestrator(duplicate, []).run(duplicate)

    auth.external_roots[0].root.chmod(0o755)
    with pytest.raises(OrchestrationFailure, match="^external_root_invalid$"):
        orchestrator(auth, []).run(auth)


def test_external_roots_reject_overlap_or_content_before_effect(tmp_path: Path) -> None:
    auth = authorization(tmp_path)
    (auth.external_roots[0].root / "occupied").write_text("x", encoding="utf-8")
    with pytest.raises(OrchestrationFailure, match="^external_root_not_empty$"):
        orchestrator(auth, []).run(auth)

    overlap_root = tmp_path / "overlap"
    overlap_root.mkdir()
    auth = authorization(overlap_root)
    nested = auth.external_roots[0].root / "nested"
    nested.mkdir(mode=0o700)
    roots = (
        auth.external_roots[0],
        replace(auth.external_roots[1], root=nested),
        *auth.external_roots[2:],
    )
    invalid = replace(
        auth,
        external_roots=roots,
        external_roots_sha256=external_roots_digest(roots),
    )
    with pytest.raises(OrchestrationFailure, match="^external_roots_overlap$"):
        orchestrator(invalid, []).run(invalid)

    protected_root = tmp_path / "protected"
    protected_root.mkdir()
    auth = authorization(protected_root)
    inside_repository = auth.repository_roots[0].root / "external-capability"
    inside_repository.mkdir(mode=0o700)
    roots = (
        replace(auth.external_roots[0], root=inside_repository),
        *auth.external_roots[1:],
    )
    invalid = replace(
        auth,
        external_roots=roots,
        external_roots_sha256=external_roots_digest(roots),
    )
    with pytest.raises(OrchestrationFailure, match="^external_root_protected_overlap$"):
        orchestrator(invalid, []).run(invalid)


def test_terminal_absence_proof_covers_every_required_absence(tmp_path: Path) -> None:
    auth = authorization(tmp_path)
    dirty = replace(snapshot(auth), pki_absent=False)

    with pytest.raises(
        OrchestrationFailure, match="^environment_artifacts_not_absent$"
    ):
        orchestrator(auth, [], snapshots=(snapshot(auth), dirty)).run(auth)

    stored = json.loads((auth.evidence_root / TERMINAL_SEAL).read_text())
    assert stored["terminal_absence_proof"] == dirty.absence_proof()
    assert stored["terminal_absence_proof_sha256"] == absence_proof_digest(dirty)
    assert stored["status"] == "failed"


@pytest.mark.parametrize(("field", "value"), (("st_uid", -1), ("st_nlink", 3)))
def test_evidence_root_rejects_wrong_owner_or_extra_links(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, field: str, value: int
) -> None:
    auth = authorization(tmp_path)
    real_fstat = storage.os.fstat
    calls = 0

    def changed_first_fstat(descriptor: int) -> os.stat_result:
        nonlocal calls
        observed = real_fstat(descriptor)
        calls += 1
        if calls != 1:
            return observed
        values = list(observed)
        values[4 if field == "st_uid" else 3] = value
        return os.stat_result(values)

    monkeypatch.setattr(storage.os, "fstat", changed_first_fstat)

    with pytest.raises(OrchestrationFailure, match="^evidence_root_invalid$"):
        orchestrator(auth, []).run(auth)
