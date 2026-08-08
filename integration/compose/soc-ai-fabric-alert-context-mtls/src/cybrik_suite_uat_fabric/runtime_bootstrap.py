"""One-way admission and bootstrap boundary for the additive runtime slice.

The first effectful callback is ``prepare_runtime``. Every signed-intent,
tuple, aggregate and external-root check precedes it. The default command has
no dependencies and therefore remains HOLD; concrete dependencies must be
assembled by the exact candidate packet after its source tuple is frozen.

This alert-context slice does not prove the existing PostgreSQL lifecycle gate.
That gate remains separately blocking until a future single-authority
orchestrator sequences both slices under one terminal seal.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Final

from . import runner

RUNTIME_SCOPE: Final = "alert_context_additive"
POSTGRESQL_CLOSURE: Final = "separate_blocking_gate"


class BootstrapError(RuntimeError):
    """Stable bootstrap failure that does not reflect collaborator detail."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class BootstrapHold(BootstrapError):
    """No exact unconsumed external authority exists; effects remain forbidden."""


@dataclass(frozen=True)
class BootstrapDependencies:
    """Injected one-way stages; importing this type performs no I/O."""

    verify_signed_intent: Callable[[], object]
    observe_exact_tuple: Callable[[object], object]
    calculate_aggregate: Callable[[object, object], object]
    bind_authorization: Callable[[object, object, object], object]
    validate_external_roots: Callable[[object], object]
    prepare_runtime: Callable[[object, object], object]
    build_runner_dependencies: Callable[[object, object, object], object]
    run_once: Callable[[object], runner.RunResult]
    abort_runtime: Callable[[object], None]


@dataclass(frozen=True, slots=True)
class BootstrapResult:
    status: str
    terminal_sha256: str
    runtime_scope: str = RUNTIME_SCOPE
    postgresql_closure: str = POSTGRESQL_CLOSURE


def _authorization_is_exact(value: object) -> bool:
    return (
        getattr(value, "exact", None) is True
        and getattr(value, "external", None) is True
        and getattr(value, "one_shot", None) is True
        and getattr(value, "consumed", None) is False
    )


def bootstrap_once(dependencies: BootstrapDependencies) -> BootstrapResult:
    """Admit, prepare and execute once; abort idempotently after any runtime error."""

    if not isinstance(dependencies, BootstrapDependencies):
        raise BootstrapHold("external_exact_authorization_absent")
    try:
        intent = dependencies.verify_signed_intent()
    except Exception:  # noqa: BLE001 - external verifier detail is not reflected.
        raise BootstrapHold("external_exact_authorization_absent") from None
    try:
        observations = dependencies.observe_exact_tuple(intent)
        aggregate = dependencies.calculate_aggregate(intent, observations)
        authorization = dependencies.bind_authorization(intent, observations, aggregate)
    except Exception:  # noqa: BLE001 - admission detail is not reflected.
        raise BootstrapHold("external_exact_authorization_invalid") from None
    if not _authorization_is_exact(authorization):
        raise BootstrapHold("external_exact_authorization_invalid")
    try:
        roots = dependencies.validate_external_roots(authorization)
    except Exception:  # noqa: BLE001 - external-root detail is not reflected.
        raise BootstrapHold("external_exact_authorization_invalid") from None

    session: object | None = None
    try:
        # Contract: a failing preparer must roll back its own partial work because
        # it has not returned the only object accepted by ``abort_runtime``.
        session = dependencies.prepare_runtime(authorization, roots)
        if session is None:
            raise RuntimeError
        runner_dependencies = dependencies.build_runner_dependencies(
            authorization, roots, session
        )
        run_result = dependencies.run_once(runner_dependencies)
        if (
            not isinstance(run_result, runner.RunResult)
            or run_result.status != "passed"
        ):
            raise RuntimeError
    except Exception:  # noqa: BLE001 - runtime detail is collapsed at the boundary.
        if session is not None:
            try:
                dependencies.abort_runtime(session)
            except Exception:  # noqa: BLE001 - abort detail is also collapsed.
                raise BootstrapError("runtime_abort_failed") from None
        raise BootstrapError("runtime_attempt_failed") from None
    return BootstrapResult(
        status="passed",
        terminal_sha256=run_result.terminal_sha256,
    )


def _hold(reason: str) -> int:
    print(
        json.dumps(
            {
                "execution_authorized": False,
                "reason": reason,
                "status": "HOLD",
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )
    return runner.HOLD_EXIT_STATUS


def _default_dependencies() -> BootstrapDependencies:
    """Load the strict external runtime wiring only for explicit execution."""

    from .runtime_wiring import build_bootstrap_dependencies

    return build_bootstrap_dependencies()


def main(
    argv: list[str] | None = None,
    *,
    dependencies_factory: Callable[[], BootstrapDependencies] = _default_dependencies,
) -> int:
    """Execute only for the exact explicit ``--execute`` command."""

    arguments = [] if argv is None else argv
    if arguments == []:
        return _hold("external_exact_authorization_absent")
    if arguments != ["--execute"]:
        raise SystemExit(runner.HOLD_EXIT_STATUS)
    try:
        result = bootstrap_once(dependencies_factory())
    except BootstrapError as error:
        return _hold(error.reason)
    print(
        json.dumps(
            {
                "postgresql_closure": result.postgresql_closure,
                "runtime_scope": result.runtime_scope,
                "status": result.status,
                "terminal_sha256": result.terminal_sha256,
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )
    return 0


__all__ = [
    "POSTGRESQL_CLOSURE",
    "RUNTIME_SCOPE",
    "BootstrapDependencies",
    "BootstrapError",
    "BootstrapHold",
    "BootstrapResult",
    "bootstrap_once",
    "main",
]
