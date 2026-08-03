"""Invoke the integrated UAT PostgreSQL D2 stage from explicit master facts."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

_SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SOURCE_ROOT))

from cybrik_suite_uat_mtls import postgres_stage


@dataclass(frozen=True, slots=True)
class _ExternalRoot:
    capability: str
    root: Path


@dataclass(frozen=True, slots=True)
class _RepositoryRoot:
    repository: str
    root: Path


@dataclass(frozen=True, slots=True)
class _RepositoryIdentity:
    repository: str
    commit: str
    tree: str
    clean: bool = True


def _binding(value: str, *, expected: str, kind: str) -> Path:
    name, separator, raw_path = value.partition("=")
    path = Path(raw_path)
    if (
        separator != "="
        or name != expected
        or not path.is_absolute()
        or str(path) != raw_path
    ):
        raise ValueError(f"{kind}_binding_invalid")
    return path


def _arguments(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False, allow_abbrev=False)
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
    ):
        parser.add_argument(f"--{name}", required=True)
    parser.add_argument("--repository", action="append", default=[])
    parser.add_argument("--repository-identity", action="append", default=[])
    parser.add_argument("--external-root", action="append", default=[])
    parser.add_argument("--master-authorization-file", required=True)
    parser.add_argument("--master-authorization-signature", required=True)
    parser.add_argument("--master-allowed-signers", required=True)
    try:
        return parser.parse_args(list(argv) if argv is not None else None)
    except SystemExit:
        raise ValueError("stage_arguments_invalid") from None


def _command_inputs(
    arguments: argparse.Namespace,
) -> tuple[SimpleNamespace, tuple[_RepositoryRoot, ...], tuple[_ExternalRoot, ...]]:
    if (
        len(arguments.repository) != len(postgres_stage._REPOSITORIES)
        or len(arguments.repository_identity) != len(postgres_stage._REPOSITORIES)
        or len(arguments.external_root) != len(postgres_stage._EXTERNAL_ROOT_ROLES)
    ):
        raise ValueError("stage_arguments_invalid")
    repositories = tuple(
        _RepositoryRoot(
            repository=name,
            root=_binding(value, expected=name, kind="repository"),
        )
        for name, value in zip(
            postgres_stage._REPOSITORIES, arguments.repository, strict=True
        )
    )
    external = tuple(
        _ExternalRoot(
            capability=capability,
            root=_binding(value, expected=capability, kind="external_root"),
        )
        for capability, value in zip(
            postgres_stage._EXTERNAL_ROOT_ROLES, arguments.external_root, strict=True
        )
    )
    identities: list[_RepositoryIdentity] = []
    for repository, value in zip(
        postgres_stage._REPOSITORIES, arguments.repository_identity, strict=True
    ):
        name, separator, raw_identity = value.partition("=")
        commit, identity_separator, tree = raw_identity.partition(":")
        if separator != "=" or name != repository or identity_separator != ":":
            raise ValueError("repository_identity_binding_invalid")
        identities.append(_RepositoryIdentity(repository, commit, tree))
    context = SimpleNamespace(
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
        master_authorization_file=Path(arguments.master_authorization_file),
        master_authorization_signature=Path(arguments.master_authorization_signature),
        master_allowed_signers=Path(arguments.master_allowed_signers),
    )
    return context, repositories, external


def _public_receipt(context: object) -> bytes:
    return postgres_stage.canonical_receipt_bytes(
        {
            "aggregate_sha256": context.aggregate_sha256,
            "external_roots_sha256": context.external_roots_sha256,
            "master_authorization_sha256": context.authorization_sha256,
            "master_marker_sha256": context.marker_sha256,
            "repository_roots_sha256": context.repository_roots_sha256,
            "repository_tuple_sha256": context.repository_tuple_sha256,
            "run_id": context.run_id,
            "schema": "cybrik.integrated-uat.public-stage-receipt/v1",
            "stage": postgres_stage.STAGE_NAME,
            "status": "passed",
        }
    )


def _absence_receipt(context: object) -> bytes:
    return postgres_stage.canonical_receipt_bytes(
        {
            "absent": True,
            "aggregate_sha256": context.aggregate_sha256,
            "authorization_sha256": context.authorization_sha256,
            "external_roots_sha256": context.external_roots_sha256,
            "marker_sha256": context.marker_sha256,
            "repository_roots_sha256": context.repository_roots_sha256,
            "repository_tuple_sha256": context.repository_tuple_sha256,
            "run_id": context.run_id,
            "schema": "cybrik.integrated-uat.absence/v1",
            "scope": postgres_stage.STAGE_NAME,
        }
    )


def main(argv: list[str] | None = None) -> int:
    try:
        arguments = _arguments(argv)
        context, repository_roots, external_roots = _command_inputs(arguments)
        adapter = postgres_stage.PostgresD2StageAdapter(
            external_roots=external_roots,
            repository_roots=repository_roots,
        )
        if arguments.action == "run":
            adapter.run(context)
            sys.stdout.buffer.write(_public_receipt(context))
        elif arguments.action == "teardown":
            adapter.teardown(context)
        else:
            adapter.verify_absent(context)
            sys.stdout.buffer.write(_absence_receipt(context))
    except (TypeError, ValueError, postgres_stage.StageFailure) as exc:
        reason = getattr(exc, "reason", str(exc))
        print(f"postgres D2 stage refused: {reason}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
