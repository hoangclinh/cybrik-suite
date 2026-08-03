"""One-shot master orchestration over injected child-stage protocols."""

from __future__ import annotations

import hashlib
import re
from typing import Protocol

from .models import (
    EXPECTED_EXTERNAL_CAPABILITIES,
    EXPECTED_PORTS,
    EXPECTED_REPOSITORIES,
    EnvironmentSnapshot,
    ExternalRootBinding,
    MasterAuthorization,
    OrchestrationContext,
    RepositoryIdentity,
    RepositoryRoot,
    StageReceipt,
    TerminalSeal,
    absence_proof_digest,
    canonical_json_bytes,
    external_roots_digest,
    repository_roots_digest,
    repository_tuple_digest,
)
from .protocols import (
    AlertContextStage,
    CommonTeardown,
    EnvironmentInspector,
    PostgresD2Stage,
)
from .storage import (
    StorageFailure,
    consume_once,
    consumption_marker_digest,
    preflight_paths,
    replace_terminal_seal,
    reserve_terminal_seal,
)

_HEX40 = re.compile(r"^[0-9a-f]{40}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_RUN_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,127}$")


class OrchestrationFailure(Exception):
    """A stable terminal or preflight reason with no injected exception text."""


class _Cleanable(Protocol):
    def teardown(self, context: OrchestrationContext) -> None: ...

    def verify_absent(self, context: OrchestrationContext) -> None: ...


def _fail(reason: str) -> None:
    raise OrchestrationFailure(reason)


def _valid_repository_tuple(
    identities: tuple[RepositoryIdentity, ...], *, dirty_reason: str
) -> None:
    if tuple(item.repository for item in identities) != EXPECTED_REPOSITORIES:
        _fail("authorization_repository_tuple_invalid")
    for item in identities:
        if not _HEX40.match(item.commit) or not _HEX40.match(item.tree):
            _fail("authorization_repository_tuple_invalid")
        if item.clean is not True:
            _fail(dirty_reason)


def _validate_authorization(authorization: MasterAuthorization) -> None:
    _valid_repository_tuple(
        authorization.repository_tuple,
        dirty_reason="authorization_repository_not_clean",
    )
    if len(authorization.repository_roots) != len(EXPECTED_REPOSITORIES) or not all(
        isinstance(root, RepositoryRoot) for root in authorization.repository_roots
    ):
        _fail("authorization_repository_roots_invalid")
    if (
        tuple(root.repository for root in authorization.repository_roots)
        != EXPECTED_REPOSITORIES
    ):
        _fail("authorization_repository_roots_invalid")
    if len(authorization.external_roots) != len(
        EXPECTED_EXTERNAL_CAPABILITIES
    ) or not all(
        isinstance(root, ExternalRootBinding) for root in authorization.external_roots
    ):
        _fail("authorization_external_roots_invalid")
    if (
        tuple(root.capability for root in authorization.external_roots)
        != EXPECTED_EXTERNAL_CAPABILITIES
    ):
        _fail("authorization_external_roots_invalid")
    if (
        not _HEX64.match(authorization.aggregate_sha256)
        or not _HEX64.match(authorization.authorization_sha256)
        or not _HEX64.match(authorization.external_roots_sha256)
        or not _HEX64.match(authorization.exact_head_grant_sha256)
        or not _HEX64.match(authorization.repository_tuple_sha256)
        or not _HEX64.match(authorization.repository_roots_sha256)
        or not _RUN_ID.match(authorization.run_id)
        or len(authorization.repository_roots) != len(EXPECTED_REPOSITORIES)
        or repository_tuple_digest(authorization.repository_tuple)
        != authorization.repository_tuple_sha256
        or repository_roots_digest(authorization.repository_roots)
        != authorization.repository_roots_sha256
        or external_roots_digest(authorization.external_roots)
        != authorization.external_roots_sha256
    ):
        _fail("authorization_repository_tuple_invalid")


def _validate_environment(
    observed: EnvironmentSnapshot,
    authorization: MasterAuthorization,
    *,
    preflight: bool,
) -> None:
    if observed.aggregate_sha256 != authorization.aggregate_sha256:
        _fail(
            "authorization_aggregate_mismatch"
            if preflight
            else "environment_aggregate_mismatch"
        )
    if observed.external_roots_sha256 != authorization.external_roots_sha256:
        _fail("environment_external_roots_mismatch")
    try:
        _valid_repository_tuple(
            observed.repository_tuple,
            dirty_reason="environment_repository_not_clean",
        )
    except OrchestrationFailure as exc:
        if str(exc) == "authorization_repository_tuple_invalid":
            _fail("environment_repository_tuple_mismatch")
        raise
    if observed.repository_roots_sha256 != authorization.repository_roots_sha256:
        _fail("environment_repository_roots_mismatch")
    if (
        observed.repository_tuple != authorization.repository_tuple
        or observed.repository_tuple_sha256 != authorization.repository_tuple_sha256
        or repository_tuple_digest(observed.repository_tuple)
        != observed.repository_tuple_sha256
    ):
        _fail("environment_repository_tuple_mismatch")
    if observed.absent_ports != EXPECTED_PORTS:
        _fail("environment_ports_not_absent")
    if not all(
        (
            observed.postgres_absent is True,
            observed.processes_absent is True,
            observed.private_artifacts_absent is True,
            observed.runtime_artifacts_absent is True,
            observed.pki_absent is True,
        )
    ):
        _fail("environment_artifacts_not_absent")


def _validate_receipt(
    received: StageReceipt,
    *,
    expected_stage: str,
    authorization: MasterAuthorization,
) -> None:
    if received.stage != expected_stage:
        _fail("stage_receipt_identity_mismatch")
    if not _HEX64.match(received.receipt_sha256):
        _fail("stage_receipt_digest_invalid")
    if received.aggregate_sha256 != authorization.aggregate_sha256:
        _fail("stage_receipt_aggregate_mismatch")
    if received.repository_tuple_sha256 != authorization.repository_tuple_sha256:
        _fail("stage_receipt_repository_tuple_mismatch")


def _stage_cleanup(stage: _Cleanable, context: OrchestrationContext) -> bool:
    failed = False
    try:
        stage.teardown(context)
    except Exception:  # noqa: BLE001 - injected adapters must fail closed.
        failed = True
    try:
        stage.verify_absent(context)
    except Exception:  # noqa: BLE001 - absence checks must still continue.
        failed = True
    return failed


def _terminal_seal(
    authorization: MasterAuthorization,
    *,
    marker_sha256: str,
    failure: str | None,
    postgres_receipt: StageReceipt | None,
    alert_receipt: StageReceipt | None,
    terminal: EnvironmentSnapshot | None,
    status: str,
) -> TerminalSeal:
    terminal_proof = (
        terminal.absence_proof()
        if terminal is not None
        else {
            "absent_ports": [],
            "external_roots_sha256": "",
            "inspection_succeeded": False,
            "pki_absent": False,
            "postgres_absent": False,
            "private_artifacts_absent": False,
            "processes_absent": False,
            "repository_roots_sha256": "",
            "repository_tuple": [],
            "repository_tuple_sha256": "",
            "runtime_artifacts_absent": False,
        }
    )
    terminal_proof_sha256 = hashlib.sha256(
        canonical_json_bytes(terminal_proof)
    ).hexdigest()
    if terminal is not None and absence_proof_digest(terminal) != terminal_proof_sha256:
        _fail("terminal_absence_proof_digest_failed")
    return TerminalSeal(
        aggregate_sha256=authorization.aggregate_sha256,
        alert_context_receipt_sha256=(
            alert_receipt.receipt_sha256 if alert_receipt is not None else None
        ),
        authorization_sha256=authorization.authorization_sha256,
        exact_head_grant_sha256=authorization.exact_head_grant_sha256,
        external_roots_sha256=authorization.external_roots_sha256,
        failure_code=failure,
        marker_sha256=marker_sha256,
        postgres_d2_receipt_sha256=(
            postgres_receipt.receipt_sha256 if postgres_receipt is not None else None
        ),
        repository_tuple=authorization.repository_tuple,
        repository_tuple_sha256=authorization.repository_tuple_sha256,
        repository_roots_sha256=authorization.repository_roots_sha256,
        run_id=authorization.run_id,
        status=status,
        terminal_absence_proof=terminal_proof,
        terminal_absence_proof_sha256=terminal_proof_sha256,
    )


class IntegratedUatOrchestrator:
    """Coordinate exactly one injected two-stage attempt and terminal seal."""

    def __init__(
        self,
        *,
        alert_context_stage: AlertContextStage,
        common_teardown: CommonTeardown,
        environment_inspector: EnvironmentInspector,
        postgres_d2_stage: PostgresD2Stage,
    ) -> None:
        self._alert = alert_context_stage
        self._common = common_teardown
        self._inspector = environment_inspector
        self._postgres = postgres_d2_stage

    def run(self, authorization: MasterAuthorization) -> TerminalSeal:
        _validate_authorization(authorization)
        try:
            preflight_paths(authorization)
        except StorageFailure as exc:
            _fail(str(exc))
        _validate_environment(self._inspector.inspect(), authorization, preflight=True)
        expected_marker_sha256 = consumption_marker_digest(authorization)
        reservation = _terminal_seal(
            authorization,
            marker_sha256=expected_marker_sha256,
            failure="attempt_interrupted_before_terminalization",
            postgres_receipt=None,
            alert_receipt=None,
            terminal=None,
            status="reserved_interrupted",
        )
        try:
            reserve_terminal_seal(authorization, reservation)
            marker, marker_sha256 = consume_once(authorization)
        except StorageFailure as exc:
            _fail(str(exc))
        if marker_sha256 != expected_marker_sha256:
            _fail("consumption_marker_digest_mismatch")
        context = OrchestrationContext(
            aggregate_sha256=authorization.aggregate_sha256,
            authorization_sha256=authorization.authorization_sha256,
            consumption_marker=marker,
            evidence_root=authorization.evidence_root,
            external_roots_sha256=authorization.external_roots_sha256,
            marker_sha256=marker_sha256,
            repository_tuple=authorization.repository_tuple,
            repository_tuple_sha256=authorization.repository_tuple_sha256,
            repository_roots_sha256=authorization.repository_roots_sha256,
            run_id=authorization.run_id,
        )
        return self._run_consumed(authorization, context, reservation)

    def _run_consumed(
        self,
        authorization: MasterAuthorization,
        context: OrchestrationContext,
        reservation: TerminalSeal,
    ) -> TerminalSeal:
        failure: str | None = None
        postgres_receipt: StageReceipt | None = None
        alert_receipt: StageReceipt | None = None

        try:
            candidate = self._postgres.run(context)
            _validate_receipt(
                candidate,
                expected_stage="postgres_d2",
                authorization=authorization,
            )
            postgres_receipt = candidate
        except OrchestrationFailure as exc:
            failure = str(exc)
        except Exception:  # noqa: BLE001 - injected failures become stable codes.
            failure = "postgres_d2_stage_failed"
        if _stage_cleanup(self._postgres, context) and failure is None:
            failure = "postgres_d2_cleanup_failed"

        if failure is None:
            try:
                candidate = self._alert.run(context)
                _validate_receipt(
                    candidate,
                    expected_stage="alert_context",
                    authorization=authorization,
                )
                alert_receipt = candidate
            except OrchestrationFailure as exc:
                failure = str(exc)
            except Exception:  # noqa: BLE001 - injected failures become stable codes.
                failure = "alert_context_stage_failed"
            if _stage_cleanup(self._alert, context) and failure is None:
                failure = "alert_context_cleanup_failed"

        common_failure: str | None = None
        try:
            self._common.teardown(context)
        except Exception:  # noqa: BLE001 - common cleanup must continue.
            common_failure = "common_teardown_failed"
        try:
            self._common.verify_absent(context)
        except Exception:  # noqa: BLE001 - absence verification must be attempted.
            common_failure = common_failure or "common_absence_check_failed"

        terminal: EnvironmentSnapshot | None = None
        terminal_failure: str | None = None
        try:
            terminal = self._inspector.inspect()
            _validate_environment(terminal, authorization, preflight=False)
        except OrchestrationFailure as exc:
            terminal_failure = str(exc)
        except Exception:  # noqa: BLE001 - injected inspection fails closed.
            terminal_failure = "terminal_inspection_failed"

        failure = failure or common_failure or terminal_failure
        if failure is None and (postgres_receipt is None or alert_receipt is None):
            failure = "stage_receipt_missing"
        seal = _terminal_seal(
            authorization,
            marker_sha256=context.marker_sha256,
            failure=failure,
            postgres_receipt=postgres_receipt,
            alert_receipt=alert_receipt,
            terminal=terminal,
            status="failed" if failure is not None else "sealed",
        )
        try:
            replace_terminal_seal(authorization, reservation, seal)
        except StorageFailure as exc:
            _fail(str(exc))
        if failure is not None:
            _fail(failure)
        return seal
