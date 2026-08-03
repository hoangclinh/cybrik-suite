"""Exact command-line contract for the master-reserved alert stage."""

from __future__ import annotations

import hmac
import sys
from argparse import ArgumentParser, Namespace
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from . import integrated_stage as stage
from . import runtime_cleanup
from .runtime_wiring_admission import RuntimeAdmissionWiringError


@dataclass(frozen=True, slots=True)
class _RepositoryRoot:
    repository: str
    root: Path


@dataclass(frozen=True, slots=True)
class _ExternalRoot:
    capability: str
    root: Path


@dataclass(frozen=True, slots=True)
class _RepositoryIdentity:
    repository: str
    commit: str
    tree: str
    clean: bool = True


@dataclass(frozen=True, slots=True)
class _MasterContext:
    aggregate_sha256: str
    authorization_sha256: str
    consumption_marker: Path
    evidence_root: Path
    external_roots_sha256: str
    marker_sha256: str
    repository_roots_sha256: str
    repository_tuple: tuple[_RepositoryIdentity, ...]
    repository_tuple_sha256: str
    run_id: str


def _binding(value: str, expected: Sequence[str], reason: str) -> dict[str, str]:
    name, separator, raw = value.partition("=")
    if separator != "=" or name not in expected or not raw:
        stage._fail(reason)
    return {name: raw}


def _parse_bindings(values: Sequence[str], expected: Sequence[str], reason: str):
    records: dict[str, str] = {}
    for value in values:
        item = _binding(value, expected, reason)
        if records.keys() & item.keys():
            stage._fail(reason)
        records.update(item)
    if tuple(records) != tuple(expected):
        stage._fail(reason)
    return records


def _arguments(argv: Sequence[str] | None) -> Namespace:
    parser = ArgumentParser(add_help=False, allow_abbrev=False)
    parser.add_argument("action", choices=("run", "teardown", "verify-absent"))
    for name in (
        "aggregate-sha256",
        "authorization-sha256",
        "external-roots-sha256",
        "marker-sha256",
        "repository-roots-sha256",
        "repository-tuple-sha256",
        "run-id",
        "consumption-marker",
        "evidence-root",
        "b1-wheel",
        "pinned-python-sha256",
    ):
        parser.add_argument(f"--{name}", required=True)
    parser.add_argument("--repository", action="append", default=[])
    parser.add_argument("--repository-identity", action="append", default=[])
    parser.add_argument("--external-root", action="append", default=[])
    try:
        return parser.parse_args(list(argv) if argv is not None else None)
    except SystemExit:
        stage._fail("stage_arguments_invalid")


def _command_inputs(arguments: Namespace):
    repository_values = _parse_bindings(
        arguments.repository,
        stage.EXPECTED_REPOSITORIES,
        "repository_roots_invalid",
    )
    identity_values = _parse_bindings(
        arguments.repository_identity,
        stage.EXPECTED_REPOSITORIES,
        "repository_tuple_invalid",
    )
    external_values = _parse_bindings(
        arguments.external_root,
        stage.EXPECTED_EXTERNAL_CAPABILITIES,
        "external_roots_invalid",
    )
    identities: list[_RepositoryIdentity] = []
    for repository in stage.EXPECTED_REPOSITORIES:
        commit, separator, tree = identity_values[repository].partition(":")
        if (
            separator != ":"
            or stage._HEX40.fullmatch(commit) is None
            or stage._HEX40.fullmatch(tree) is None
        ):
            stage._fail("repository_tuple_invalid")
        identities.append(_RepositoryIdentity(repository, commit, tree))
    context = _MasterContext(
        aggregate_sha256=arguments.aggregate_sha256,
        authorization_sha256=arguments.authorization_sha256,
        consumption_marker=Path(arguments.consumption_marker),
        evidence_root=Path(arguments.evidence_root),
        external_roots_sha256=arguments.external_roots_sha256,
        marker_sha256=arguments.marker_sha256,
        repository_roots_sha256=arguments.repository_roots_sha256,
        repository_tuple=tuple(identities),
        repository_tuple_sha256=arguments.repository_tuple_sha256,
        run_id=arguments.run_id,
    )
    repositories = tuple(
        _RepositoryRoot(name, Path(repository_values[name]))
        for name in stage.EXPECTED_REPOSITORIES
    )
    external = tuple(
        _ExternalRoot(name, Path(external_values[name]))
        for name in stage.EXPECTED_EXTERNAL_CAPABILITIES
    )
    return context, repositories, external


def _verify_no_residual(context: object, external_roots: Sequence[object]) -> str:
    stage._validate_marker_bindings(context)
    digest = stage.external_roots_digest(external_roots)
    if not hmac.compare_digest(
        digest, stage._hex(getattr(context, "external_roots_sha256", None))
    ):
        stage._fail("external_roots_invalid")
    runtime, evidence, state = (
        stage._exact_directory(path, empty=False, reason="stage_residual_present")
        for path in tuple(item.root for item in external_roots)[2:]
    )
    if any(runtime.iterdir()) or any(evidence.iterdir()) or any(state.iterdir()):
        stage._fail("stage_residual_present")
    return digest


def _teardown(context: object, external_roots: Sequence[object]) -> None:
    stage._validate_marker_bindings(context)
    digest = stage.external_roots_digest(external_roots)
    if not hmac.compare_digest(
        digest, stage._hex(getattr(context, "external_roots_sha256", None))
    ):
        stage._fail("external_roots_invalid")
    roots = tuple(item.root for item in external_roots)[2:]
    if len(roots) != 3:
        stage._fail("external_roots_invalid")
    failed = False
    for root in roots:
        try:
            runtime_cleanup.clear_bound_root(root)
        except RuntimeAdmissionWiringError:
            failed = True
    if failed:
        stage._fail("stage_teardown_failed")


def main(argv: Sequence[str] | None = None) -> int:
    """Execute one master-reserved command; failures emit no child detail."""

    arguments = _arguments(argv)
    context, repositories, external = _command_inputs(arguments)
    if arguments.action == "run":
        plan = stage.build_master_reserved_stage_dependencies(
            master_context=context,
            repository_roots=repositories,
            external_roots=external,
            b1_wheel=Path(arguments.b1_wheel),
            pinned_python=Path(sys.executable).resolve(),
            pinned_python_sha256=arguments.pinned_python_sha256,
        )
        stage.runtime_wiring.run_reserved_stage(plan.dependencies, plan.binding)
        sys.stdout.buffer.write(
            stage.public_receipt(
                context, external_roots_sha256=plan.external_roots_sha256
            )
        )
        return 0
    if arguments.action == "teardown":
        _teardown(context, external)
    digest = _verify_no_residual(context, external)
    if arguments.action == "verify-absent":
        sys.stdout.buffer.write(
            stage.absence_receipt(context, external_roots_sha256=digest)
        )
    return 0


__all__ = ["_parse_bindings", "main"]
