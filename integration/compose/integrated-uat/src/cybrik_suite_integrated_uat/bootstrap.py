"""Explicit one-shot bootstrap for the integrated UAT master."""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import TextIO


class BootstrapHold(RuntimeError):
    """Admission or pre-effect construction failed closed."""


class BootstrapError(RuntimeError):
    """The admitted attempt entered orchestration and failed."""


@dataclass(frozen=True, slots=True)
class BootstrapDependencies:
    admit: Callable[[], object]
    build_orchestrator: Callable[[object], object]


@dataclass(frozen=True, slots=True)
class BootstrapResult:
    seal: object


def bootstrap_once(dependencies: BootstrapDependencies) -> object:
    """Admit, construct, and invoke exactly one master orchestration attempt."""

    if not isinstance(dependencies, BootstrapDependencies):
        raise BootstrapHold("external_exact_authorization_invalid")
    try:
        admitted = dependencies.admit()
        authorization = admitted.authorization
        orchestrator = dependencies.build_orchestrator(admitted)
    except Exception as exc:
        raise BootstrapHold("external_exact_authorization_invalid") from exc
    try:
        return orchestrator.run(authorization)
    except Exception as exc:
        raise BootstrapError("integrated_uat_attempt_failed") from exc


def build_dependencies_from_environment(
    environment: Mapping[str, str] | None = None,
) -> BootstrapDependencies:
    """Build inert closures; authorization occurs only when ``admit`` is called."""

    from .adapters import (
        AlertContextStage,
        CommonTeardown,
        CompositeCommonTeardown,
        EnvironmentInspector,
        PostgresD2Stage,
    )
    from .admission import HELPER_SCRIPTS, admit_master_authorization
    from .orchestrator import IntegratedUatOrchestrator

    selected = dict(os.environ if environment is None else environment)

    def admit() -> object:
        return admit_master_authorization(selected)

    def build(admitted: object) -> IntegratedUatOrchestrator:
        try:
            authorization = admitted.authorization
            common = {
                "authorization": authorization,
                "python_executable": admitted.python_executable,
                "suite_root": admitted.suite_root,
            }
            postgres = PostgresD2Stage(
                **common,
                authorization_file=admitted.authorization_file,
                authorization_signature=admitted.authorization_signature,
                allowed_signers_file=admitted.allowed_signers_file,
                b1_wheel=admitted.b1_wheel,
                b1_wheel_sha256=admitted.b1_wheel_sha256,
                script_sha256=admitted.helper_sha256[HELPER_SCRIPTS[0]],
            )
            alert = AlertContextStage(
                **common,
                b1_wheel=admitted.b1_wheel,
                b1_wheel_sha256=admitted.b1_wheel_sha256,
                python_sha256=admitted.python_sha256,
                script_sha256=admitted.helper_sha256[HELPER_SCRIPTS[1]],
            )
            inspector = EnvironmentInspector(
                **common, script_sha256=admitted.helper_sha256[HELPER_SCRIPTS[2]]
            )
            supplemental = CommonTeardown(
                **common, script_sha256=admitted.helper_sha256[HELPER_SCRIPTS[3]]
            )
            teardown = CompositeCommonTeardown(
                alert_context_stage=alert,
                postgres_d2_stage=postgres,
                supplemental=supplemental,
            )
        except (AttributeError, KeyError, TypeError) as exc:
            raise BootstrapHold("external_exact_authorization_invalid") from exc
        return IntegratedUatOrchestrator(
            alert_context_stage=alert,
            common_teardown=teardown,
            environment_inspector=inspector,
            postgres_d2_stage=postgres,
        )

    return BootstrapDependencies(admit=admit, build_orchestrator=build)


def _emit(output: TextIO, document: Mapping[str, object]) -> None:
    output.write(json.dumps(document, sort_keys=True, separators=(",", ":")) + "\n")


def _hold(output: TextIO, reason: str) -> int:
    _emit(
        output,
        {
            "execution_authorized": False,
            "reason": reason,
            "status": "HOLD",
        },
    )
    return 2


def main(
    argv: Sequence[str] | None = None,
    *,
    environment: Mapping[str, str] | None = None,
    output: TextIO | None = None,
    dependency_builder: Callable[
        [Mapping[str, str] | None], BootstrapDependencies
    ] = build_dependencies_from_environment,
) -> int:
    arguments = tuple(sys.argv[1:] if argv is None else argv)
    destination = sys.stdout if output is None else output
    if arguments != ("--execute",):
        return _hold(destination, "external_exact_authorization_absent")
    try:
        dependencies = dependency_builder(environment)
        seal = bootstrap_once(dependencies)
    except BootstrapHold:
        return _hold(destination, "external_exact_authorization_invalid")
    except BootstrapError:
        _emit(
            destination,
            {
                "execution_authorized": True,
                "reason": "integrated_uat_attempt_failed",
                "status": "FAILED",
            },
        )
        return 1
    try:
        document = seal.to_dict()
    except (AttributeError, TypeError, ValueError):
        _emit(
            destination,
            {
                "execution_authorized": True,
                "reason": "integrated_uat_attempt_failed",
                "status": "FAILED",
            },
        )
        return 1
    _emit(destination, document)
    return 0


__all__ = [
    "BootstrapDependencies",
    "BootstrapError",
    "BootstrapHold",
    "BootstrapResult",
    "bootstrap_once",
    "build_dependencies_from_environment",
    "main",
]
