"""Inert outer wiring boundary for the admitted three-process UAT."""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from types import MappingProxyType
from typing import Final

from . import admission, runner, runtime_bootstrap, runtime_case_wiring, runtime_cases
from .runtime_wiring_admission import (
    B1_WHEEL_FILENAME,
    ExternalRoots,
    RepositoryLayout,
    RuntimeAdmissionWiringError,
    RuntimeEnvironment,
    SignedIntent,
    ensure_one_shot_available,
    load_runtime_environment,
    verify_signed_intent,
)
from .runtime_wiring_process import (
    AuthenticatedSupervisorController,
    HttpResponse,
    PinnedHttpsClient,
    RoleHandle,
    RuntimeAuthorizationBinding,
    RuntimeProcessContext,
    RuntimeSession,
    SecureReceiptFileSystem,
    prepare_concrete_runtime,
)

RuntimeWiringError = RuntimeAdmissionWiringError

TRACKED_ALLOWLIST: Final[Mapping[str, tuple[str, ...]]] = MappingProxyType(
    {
        "suite": tuple(
            sorted(
                {
                    "integration/compose/soc-ai-fabric-alert-context-mtls/README.md",
                    "integration/compose/soc-ai-fabric-alert-context-mtls/authorization-trust.json",
                    "integration/compose/soc-ai-fabric-alert-context-mtls/pyproject.toml",
                    "integration/compose/soc-ai-fabric-alert-context-mtls/scripts/integrated_uat_stage.py",
                    "integration/compose/soc-ai-fabric-alert-context-mtls/scripts/run_local_uat.py",
                    "integration/compose/soc-ai-fabric-alert-context-mtls/src/cybrik_suite_uat_fabric/__init__.py",
                    *(
                        "integration/compose/soc-ai-fabric-alert-context-mtls/src/"
                        f"cybrik_suite_uat_fabric/{name}.py"
                        for name in (
                            "admission",
                            "ai_app",
                            "b1_runtime",
                            "bootstrap",
                            "composition",
                            "driver",
                            "evidence",
                            "fabric_app",
                            "integrated_stage",
                            "integrated_stage_cli",
                            "receipt_identity",
                            "runner",
                            "runtime_bootstrap",
                            "runtime_case_wiring",
                            "runtime_cases",
                            "runtime_composition",
                            "runtime_cleanup",
                            "runtime_pki",
                            "runtime_process",
                            "runtime_supervisor",
                            "runtime_wiring",
                            "runtime_wiring_admission",
                            "runtime_wiring_process",
                            "soc_service_app",
                            "tls_process",
                        )
                    ),
                }
            )
        ),
        "soc": (
            "services/api/src/cybrik_soc/modules/alert/context/__init__.py",
            "services/api/src/cybrik_soc/modules/alert/context/authorize.py",
            "services/api/src/cybrik_soc/modules/alert/context/clearance.py",
            "services/api/src/cybrik_soc/modules/alert/context/digest.py",
            "services/api/src/cybrik_soc/modules/alert/context/models.py",
            "services/api/src/cybrik_soc/modules/alert/context/ports.py",
            "services/api/src/cybrik_soc/modules/alert/context/redact.py",
            "services/api/src/cybrik_soc/modules/alert/context/service.py",
            "services/api/src/cybrik_soc/modules/org/contract.py",
        ),
        "cyber_ai": (
            "packages/ai-core/src/cybrik_ai_core/__init__.py",
            "packages/ai-core/src/cybrik_ai_core/contract/__init__.py",
            "packages/ai-core/src/cybrik_ai_core/contract/common.py",
            "packages/ai-core/src/cybrik_ai_core/contract/inference.py",
            "packages/ai-core/src/cybrik_ai_core/contract/summarization.py",
            "packages/ai-core/src/cybrik_ai_core/errors.py",
            "packages/ai-core/src/cybrik_ai_core/modelrt/__init__.py",
            "packages/ai-core/src/cybrik_ai_core/modelrt/port.py",
            "packages/ai-core/src/cybrik_ai_core/modelrt/types.py",
            "packages/ai-core/src/cybrik_ai_core/policy.py",
            "packages/ai-core/src/cybrik_ai_core/prompts.py",
            "services/ai-api/src/cybrik_ai_api/summarize/__init__.py",
            "services/ai-api/src/cybrik_ai_api/summarize/service.py",
        ),
        "tool_fabric": (
            "src/control-plane/cybrik_fabric_control/__init__.py",
            "src/control-plane/cybrik_fabric_control/contracts/__init__.py",
            "src/control-plane/cybrik_fabric_control/contracts/invocation.py",
            "src/control-plane/cybrik_fabric_control/contracts/jcs.py",
            "src/control-plane/cybrik_fabric_control/invocation/__init__.py",
            "src/control-plane/cybrik_fabric_control/invocation/bound_receipt.py",
            "src/control-plane/cybrik_fabric_control/invocation/fsync_journal.py",
            "src/control-plane/cybrik_fabric_control/invocation/models.py",
            "src/control-plane/cybrik_fabric_control/invocation/ports.py",
            "src/control-plane/cybrik_fabric_control/invocation/service.py",
            "src/control-plane/cybrik_fabric_control/runtime_adapters.py",
            "src/control-plane/cybrik_fabric_control/runtime_routes.py",
        ),
    }
)


@dataclass(frozen=True, slots=True)
class WiringAdapters:
    prepare_session: Callable[[object, RuntimeAuthorizationBinding], RuntimeSession]
    build_case_wiring: Callable[
        [object, RuntimeAuthorizationBinding, RuntimeSession],
        runtime_case_wiring.RuntimeCaseWiring,
    ]
    now: Callable[[], datetime] = lambda: datetime.now(UTC)
    observe: Callable[
        [Sequence[admission.RepoExpectation]],
        tuple[admission.RepositoryObservation, ...],
    ] = admission.observe_exact_tuple
    aggregate: Callable[
        [Sequence[admission.RepositoryObservation], Mapping[str, Sequence[str]]],
        admission.TrackedBlobAggregate,
    ] = admission.tracked_blob_aggregate


@dataclass(frozen=True, slots=True)
class ReservedStageResult:
    """Unsealed child result returned only to a reserving master orchestrator."""

    cases: tuple[Mapping[str, object], ...]
    absence: Mapping[str, bool]


def run_reserved_stage(
    dependencies: runner.RunnerDependencies, reservation: object
) -> ReservedStageResult:
    """Run this slice without child authorization consumption or terminal sealing.

    The caller owns reservation admission and the single master terminal seal.
    Standalone :func:`runner.run_once` semantics are unchanged.
    """

    if not isinstance(dependencies, runner.RunnerDependencies) or reservation is None:
        raise RuntimeWiringError("master_reservation_invalid")
    started: list[tuple[object, Callable[[object], None]]] = []
    cases: list[Mapping[str, object]] = []
    failed = False
    try:
        for launch, ready, stop in (
            (
                dependencies.start_soc,
                dependencies.wait_soc_ready,
                dependencies.stop_soc,
            ),
            (
                dependencies.start_fabric,
                dependencies.wait_fabric_ready,
                dependencies.stop_fabric,
            ),
            (dependencies.start_ai, dependencies.wait_ai_ready, dependencies.stop_ai),
        ):
            handle = launch(reservation)
            if handle is None:
                raise RuntimeError
            started.append((handle, stop))
            ready(handle)
        for callback in (
            dependencies.run_positive,
            dependencies.run_f1,
            dependencies.run_f2,
        ):
            record = callback(reservation)
            if not isinstance(record, Mapping) or record.get("passed") is not True:
                raise RuntimeError
            cases.append(dict(record))
    except Exception:  # noqa: BLE001 - master receives only a stable stage refusal.
        failed = True
    finally:
        for handle, stop in reversed(started):
            try:
                stop(handle)
            except Exception:  # noqa: BLE001 - every reverse stop must be attempted.
                failed = True
        try:
            dependencies.finalize_runtime(reservation)
        except Exception:  # noqa: BLE001 - finalizer detail is not master evidence.
            failed = True
    try:
        absence = dict(dependencies.verify_absent(reservation))
    except Exception as exc:
        raise RuntimeWiringError("reserved_stage_failed") from exc
    if (
        failed
        or set(absence) != set(runner.REQUIRED_ABSENCE_CHECKS)
        or any(value is not True for value in absence.values())
    ):
        raise RuntimeWiringError("reserved_stage_failed")
    return ReservedStageResult(tuple(cases), MappingProxyType(absence))


class _RecordingPositiveClient:
    def __init__(self, client: PinnedHttpsClient) -> None:
        self._client = client
        self.last: HttpResponse | None = None

    def post(self, path: str, **kwargs: object) -> HttpResponse:
        self.last = self._client.post(path, **kwargs)
        return self.last


def _f1_request() -> dict[str, object]:
    return {
        "action_id": "act-alert-context-f1-0001",
        "idempotency_key": "idem-f1-actor-mismatch-0001",
        "tenant_id": "tenant-acme",
        "actor": {
            "type": "agent",
            "id": "body-selected-actor",
            "tenant_id": "tenant-acme",
        },
        "purpose": "alert_triage",
        "delegation_ref": "sha256:" + "c" * 64,
        "capability": {
            "name": "soc.get_alert_context",
            "version": "0.1.0",
            "digest": "sha256:" + "1" * 64,
        },
        "arguments": {
            "request_id": "req-alert-context-f1-0001",
            "org_scope": {"org_id": "org-soc-east", "include_descendants": False},
            "clearance": {"classification": "confidential", "tlp": "TLP:AMBER"},
            "alert_ref": {
                "type": "soc.alert",
                "id": "alert-0001",
                "version": "17",
                "digest": "sha256:" + "3" * 64,
            },
            "policy_digest": "sha256:" + "2" * 64,
            "requested_at": "2026-08-03T00:00:00Z",
        },
        "data_marking": {"classification": "confidential", "tlp": "TLP:AMBER"},
        "execution": {"mode": "execute", "deadline_seconds": 10},
    }


def _build_concrete_cases(
    config: object,
    _authorization: RuntimeAuthorizationBinding,
    session: RuntimeSession,
) -> runtime_case_wiring.RuntimeCaseWiring:
    from .bootstrap import prepend_import_roots

    context = session.runtime_context
    if not isinstance(context, RuntimeProcessContext):
        raise RuntimeWiringError("runtime_context_invalid")
    prepend_import_roots(
        __import__("sys").path,
        (
            config.repositories.soc_source,
            config.repositories.cyber_ai_api_source,
            config.repositories.cyber_ai_core_source,
            config.repositories.tool_fabric_source,
        ),
    )
    from .driver import build_summarization_request

    positive = _RecordingPositiveClient(context.clients["ai"])

    def receipt_probe() -> Mapping[str, object]:
        durable = any(
            path.is_file() and not path.is_symlink() and path.stat().st_size > 0
            for path in context.journal_root.rglob("*")
        )
        completed = (
            positive.last is not None
            and positive.last.status_code == 200
            and isinstance(positive.last.json(), dict)
            and positive.last.json().get("outcome") == "completed"  # type: ignore[union-attr]
        )
        return {
            "receipt_verified": completed,
            "durable_receipt": durable,
            "side_effect_performed": False if completed else None,
        }

    def tamper_probe(copied: Path) -> Mapping[str, object]:
        from cybrik_fabric_control.invocation.fsync_journal import (
            FsyncAppendOnlyReceiptJournal,
            ReconciliationClass,
        )

        candidates = sorted(path for path in copied.rglob("*.json") if path.is_file())
        if not candidates:
            return {"disposition": "not_durable", "receipt": None}
        target = candidates[0]
        target.write_bytes(target.read_bytes() + b" ")
        report = FsyncAppendOnlyReceiptJournal(copied).reconcile(
            tenant_id="tenant-acme", limit=1000
        )
        rejected = any(
            item.classification is ReconciliationClass.INTEGRITY_FAILURE
            for item in report.items
        )
        return {
            "disposition": "unverifiable" if rejected else "available",
            "receipt": None if rejected else {},
        }

    return runtime_case_wiring.RuntimeCaseWiring(
        positive_client=positive,
        f1_client=context.clients["fabric"],
        soc_metrics_client=context.clients["soc"],
        ai_metrics_client=context.clients["ai"],
        positive_request=build_summarization_request(
            tenant_id="tenant-acme",
            actor_id="membership-analyst-42",
            alert_id="alert-0001",
            alert_digest="sha256:" + "3" * 64,
        ),
        f1_request=_f1_request(),
        journal_root=context.journal_root,
        scratch_root=context.scratch_root,
        authoritative_receipt_probe=receipt_probe,
        copied_receipt_tamper_probe=tamper_probe,
    )


def _default_prepare(
    config: object, authorization: RuntimeAuthorizationBinding
) -> RuntimeSession:
    return prepare_concrete_runtime(
        config, authorization, tracked_allowlist=TRACKED_ALLOWLIST
    )


def build_bootstrap_dependencies(
    environment: Mapping[str, str] | None = None,
    *,
    adapters: WiringAdapters | None = None,
) -> runtime_bootstrap.BootstrapDependencies:
    config = load_runtime_environment(
        os.environ if environment is None else environment
    )
    selected = adapters or WiringAdapters(
        prepare_session=_default_prepare,
        build_case_wiring=_build_concrete_cases,
    )

    def verify() -> SignedIntent:
        return verify_signed_intent(config)

    def observe(intent: object) -> tuple[admission.RepositoryObservation, ...]:
        if not isinstance(intent, SignedIntent):
            raise RuntimeWiringError("authorization_tuple_invalid")
        return selected.observe(intent.expectations)

    def aggregate(
        intent: object, observations: object
    ) -> admission.TrackedBlobAggregate:
        if not isinstance(intent, SignedIntent) or not isinstance(observations, tuple):
            raise RuntimeWiringError("authorization_tuple_invalid")
        return selected.aggregate(observations, TRACKED_ALLOWLIST)

    def bind(
        intent: object, observations: object, aggregate_value: object
    ) -> admission.ExternalAuthorization:
        if (
            not isinstance(intent, SignedIntent)
            or not isinstance(observations, tuple)
            or not isinstance(aggregate_value, admission.TrackedBlobAggregate)
        ):
            raise RuntimeWiringError("authorization_tuple_invalid")

        def verifier(payload: bytes, signature: bytes) -> str | None:
            if payload != intent.payload or signature != intent.signature:
                return None
            return config.allowed_signer

        return admission.admit_external_authorization(
            authorization_path=config.authorization_file,
            signature_path=config.signature_file,
            observations=observations,
            aggregate=aggregate_value,
            verifier=verifier,
            now=selected.now(),
        )

    def validate_roots(authorization: object) -> ExternalRoots:
        ensure_one_shot_available(authorization, config.external.state_root)
        if any(config.external.runtime_root.iterdir()) or any(
            config.external.evidence_root.iterdir()
        ):
            raise RuntimeWiringError("external_root_not_empty")
        return config.external

    def prepare(authorization: object, _roots: object) -> RuntimeSession:
        if not isinstance(authorization, admission.ExternalAuthorization):
            raise RuntimeWiringError("authorization_invalid")
        return selected.prepare_session(config, authorization)

    def build_runner(
        authorization: object, _roots: object, session: object
    ) -> runner.RunnerDependencies:
        if not isinstance(
            authorization, admission.ExternalAuthorization
        ) or not isinstance(session, RuntimeSession):
            raise RuntimeWiringError("runtime_session_invalid")
        cases = runtime_cases.build_case_callbacks(
            runtime_case_wiring.build_runtime_case_dependencies(
                selected.build_case_wiring(config, authorization, session)
            )
        )

        def consume(admitted: object, _terminal_sha256: str) -> None:
            if not isinstance(admitted, admission.ExternalAuthorization):
                raise RuntimeWiringError("authorization_invalid")
            admission.consume_once(
                admitted,
                state_root=config.external.state_root,
                repository_roots=config.repositories.roots,
                allowlist=TRACKED_ALLOWLIST,
                now=selected.now(),
            )

        return runner.RunnerDependencies(
            authorize=lambda: authorization,
            start_soc=lambda _authorization: session.start("soc"),
            wait_soc_ready=session.wait_ready,
            start_fabric=lambda _authorization: session.start("fabric"),
            wait_fabric_ready=session.wait_ready,
            start_ai=lambda _authorization: session.start("ai"),
            wait_ai_ready=session.wait_ready,
            run_positive=cases.positive,
            run_f1=cases.f1,
            run_f2=cases.f2,
            stop_ai=session.stop,
            stop_fabric=session.stop,
            stop_soc=session.stop,
            verify_absent=lambda _authorization: session.verify_absent(),
            consume_authorization=consume,
            finalize_runtime=lambda _authorization: session.finalize(),
            evidence_root_for=lambda _authorization: config.external.evidence_root,
        )

    return runtime_bootstrap.BootstrapDependencies(
        verify_signed_intent=verify,
        observe_exact_tuple=observe,
        calculate_aggregate=aggregate,
        bind_authorization=bind,
        validate_external_roots=validate_roots,
        prepare_runtime=prepare,
        build_runner_dependencies=build_runner,
        run_once=runner.run_once,
        abort_runtime=lambda session: session.finalize(),
    )


__all__ = [
    "B1_WHEEL_FILENAME",
    "TRACKED_ALLOWLIST",
    "AuthenticatedSupervisorController",
    "ExternalRoots",
    "RepositoryLayout",
    "ReservedStageResult",
    "RoleHandle",
    "RuntimeEnvironment",
    "RuntimeSession",
    "RuntimeWiringError",
    "SecureReceiptFileSystem",
    "SignedIntent",
    "build_bootstrap_dependencies",
    "ensure_one_shot_available",
    "load_runtime_environment",
    "run_reserved_stage",
    "runner",
    "verify_signed_intent",
]
