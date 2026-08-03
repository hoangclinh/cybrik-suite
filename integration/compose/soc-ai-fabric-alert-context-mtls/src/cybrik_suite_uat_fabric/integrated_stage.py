"""Master-reserved alert-context stage without a child authority.

The integrated master has already verified and consumed the single one-shot
grant before this module is called.  This boundary validates that durable
marker and re-observes every pinned input, but never verifies a second
signature, consumes another marker, or writes a child terminal seal.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import stat
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from importlib import import_module
from pathlib import Path
from types import MappingProxyType
from typing import Final, NoReturn

from . import (
    admission,
    runner,
    runtime_case_wiring,
    runtime_cases,
    runtime_wiring,
)
from . import (
    integrated_stage_cli as _cli,
)
from .b1_runtime import B1_WHEEL_FILENAME, B1_WHEEL_SHA256
from .runtime_wiring_admission import ExternalRoots, RepositoryLayout
from .runtime_wiring_process import RuntimeSession

EXPECTED_REPOSITORIES: Final = (
    "cybrik-soc-command-center",
    "cybrik-cyber-ai-platform",
    "cybrik-security-tool-fabric",
    "cybrik-suite",
)
EXPECTED_EXTERNAL_CAPABILITIES: Final = (
    "postgres_d2_runtime",
    "postgres_d2_evidence",
    "alert_context_runtime",
    "alert_context_evidence",
    "alert_context_state",
)
MASTER_MARKER_NAME: Final = ".cybrik-integrated-uat-consumed.json"
MAX_MARKER_BYTES: Final = 64 * 1024

_HEX40 = re.compile(r"[0-9a-f]{40}")
_HEX64 = re.compile(r"[0-9a-f]{64}")
_RUN_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,127}")
_REPOSITORY_TO_ROLE: Final = MappingProxyType(
    {
        "cybrik-suite": "suite",
        "cybrik-soc-command-center": "soc",
        "cybrik-cyber-ai-platform": "cyber_ai",
        "cybrik-security-tool-fabric": "tool_fabric",
    }
)


class IntegratedStageFailure(RuntimeError):
    """Stable stage refusal which never reflects caller-controlled detail."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _fail(reason: str) -> NoReturn:
    raise IntegratedStageFailure(reason)


def _canonical(document: object) -> bytes:
    try:
        return (
            json.dumps(document, allow_nan=False, sort_keys=True, separators=(",", ":"))
            + "\n"
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError):
        _fail("master_reservation_invalid")


def _hex(value: object, pattern: re.Pattern[str] = _HEX64) -> str:
    if not isinstance(value, str) or pattern.fullmatch(value) is None:
        _fail("master_reservation_invalid")
    return value


def _exact_directory(
    path: object, *, empty: bool, reason: str, mode: int | None = 0o700
) -> Path:
    if not isinstance(path, Path) or not path.is_absolute() or path.is_symlink():
        _fail(reason)
    try:
        resolved = path.resolve(strict=True)
        identity = path.lstat()
        has_entries = any(path.iterdir()) if empty else False
    except OSError:
        _fail(reason)
    if (
        resolved != path
        or not stat.S_ISDIR(identity.st_mode)
        or identity.st_uid != os.geteuid()
        or (mode is not None and stat.S_IMODE(identity.st_mode) != mode)
        or has_entries
    ):
        _fail(reason)
    return path


def _exact_file(
    path: object, *, mode: int, reason: str, allow_root_owner: bool = False
) -> tuple[Path, bytes]:
    if not isinstance(path, Path) or not path.is_absolute() or path.is_symlink():
        _fail(reason)
    descriptor = -1
    try:
        descriptor = os.open(
            path,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
        )
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_uid
            not in ({0, os.geteuid()} if allow_root_owner else {os.geteuid()})
            or before.st_nlink != 1
            or stat.S_IMODE(before.st_mode) != mode
            or before.st_size < 1
            or before.st_size > 64 * 1024 * 1024
        ):
            _fail(reason)
        chunks: list[bytes] = []
        remaining = before.st_size
        while remaining:
            block = os.read(descriptor, min(1024 * 1024, remaining))
            if not block:
                _fail(reason)
            chunks.append(block)
            remaining -= len(block)
        after = os.fstat(descriptor)
        current = os.stat(path, follow_symlinks=False)
    except OSError:
        _fail(reason)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
    fields = ("st_dev", "st_ino", "st_uid", "st_mode", "st_nlink", "st_size")
    if any(
        getattr(before, field) != getattr(after, field)
        or getattr(before, field) != getattr(current, field)
        for field in fields
    ):
        _fail(reason)
    return path, b"".join(chunks)


def repository_roots_digest(roots: Sequence[object]) -> str:
    items = tuple(roots)
    if (
        len(items) != len(EXPECTED_REPOSITORIES)
        or tuple(getattr(item, "repository", None) for item in items)
        != EXPECTED_REPOSITORIES
    ):
        _fail("repository_roots_invalid")
    return hashlib.sha256(
        _canonical(
            [{"repository": item.repository, "root": str(item.root)} for item in items]
        )
    ).hexdigest()


def external_roots_digest(roots: Sequence[object]) -> str:
    items = tuple(roots)
    if (
        len(items) != len(EXPECTED_EXTERNAL_CAPABILITIES)
        or tuple(getattr(item, "capability", None) for item in items)
        != EXPECTED_EXTERNAL_CAPABILITIES
    ):
        _fail("external_roots_invalid")
    return hashlib.sha256(
        _canonical(
            [{"capability": item.capability, "root": str(item.root)} for item in items]
        )
    ).hexdigest()


@dataclass(frozen=True, slots=True)
class ReservedRuntimeBinding:
    """Runtime input binding, deliberately not an authorization record."""

    authorization_id: str
    authorization_sha256: str
    aggregate: admission.TrackedBlobAggregate
    observations: tuple[admission.RepositoryObservation, ...]


@dataclass(frozen=True, slots=True)
class _ReservedRuntimeConfig:
    repositories: RepositoryLayout
    external: ExternalRoots
    b1_wheel: Path
    python: Path


@dataclass(frozen=True, slots=True)
class MasterReservedStageDependencies:
    binding: ReservedRuntimeBinding
    dependencies: runner.RunnerDependencies
    external_roots_sha256: str


def _marker_document(context: object) -> Mapping[str, object]:
    evidence_root = _exact_directory(
        getattr(context, "evidence_root", None),
        empty=False,
        reason="master_reservation_invalid",
    )
    marker = getattr(context, "consumption_marker", None)
    if marker != evidence_root / MASTER_MARKER_NAME:
        _fail("master_reservation_invalid")
    _, payload = _exact_file(marker, mode=0o600, reason="master_reservation_invalid")
    if len(payload) > MAX_MARKER_BYTES:
        _fail("master_reservation_invalid")
    try:
        document = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError):
        _fail("master_reservation_invalid")
    expected = {
        "aggregate_sha256",
        "authorization_sha256",
        "exact_head_grant_sha256",
        "external_roots_sha256",
        "one_shot",
        "repository_roots_sha256",
        "repository_tuple_sha256",
        "run_id",
        "status",
    }
    if (
        not isinstance(document, dict)
        or set(document) != expected
        or _canonical(document) != payload
        or document.get("one_shot") is not True
        or document.get("status") != "consumed"
        or _HEX64.fullmatch(str(document.get("exact_head_grant_sha256", ""))) is None
        or not hmac.compare_digest(
            hashlib.sha256(payload).hexdigest(),
            _hex(getattr(context, "marker_sha256", None)),
        )
    ):
        _fail("master_reservation_invalid")
    return document


def _validate_marker_bindings(context: object) -> dict[str, str]:
    marker = _marker_document(context)
    values = {
        "aggregate_sha256": _hex(getattr(context, "aggregate_sha256", None)),
        "authorization_sha256": _hex(getattr(context, "authorization_sha256", None)),
        "external_roots_sha256": _hex(getattr(context, "external_roots_sha256", None)),
        "repository_roots_sha256": _hex(
            getattr(context, "repository_roots_sha256", None)
        ),
        "repository_tuple_sha256": _hex(
            getattr(context, "repository_tuple_sha256", None)
        ),
        "run_id": _hex(getattr(context, "run_id", None), _RUN_ID),
    }
    if any(marker.get(name) != value for name, value in values.items()):
        _fail("master_reservation_invalid")
    return values


def _repository_inputs(
    context: object, roots: Sequence[object]
) -> tuple[RepositoryLayout, tuple[admission.RepoExpectation, ...]]:
    items = tuple(roots)
    observed_roots_sha = repository_roots_digest(items)
    if not hmac.compare_digest(
        observed_roots_sha,
        _hex(getattr(context, "repository_roots_sha256", None)),
    ):
        _fail("repository_roots_invalid")
    root_by_name: dict[str, Path] = {}
    for item in items:
        root = _exact_directory(
            getattr(item, "root", None),
            empty=False,
            reason="repository_roots_invalid",
            mode=None,
        )
        root_by_name[item.repository] = root
    identities = getattr(context, "repository_tuple", None)
    if not isinstance(identities, tuple) or len(identities) != len(items):
        _fail("repository_tuple_invalid")
    by_name = {getattr(item, "repository", None): item for item in identities}
    tuple_payload = []
    for repository in EXPECTED_REPOSITORIES:
        identity = by_name.get(repository)
        commit = _hex(getattr(identity, "commit", None), _HEX40)
        tree = _hex(getattr(identity, "tree", None), _HEX40)
        if getattr(identity, "clean", None) is not True:
            _fail("repository_tuple_invalid")
        tuple_payload.append(
            {
                "clean": True,
                "commit": commit,
                "repository": repository,
                "tree": tree,
            }
        )
    tuple_sha = hashlib.sha256(_canonical(tuple_payload)).hexdigest()
    if not hmac.compare_digest(
        tuple_sha, _hex(getattr(context, "repository_tuple_sha256", None))
    ):
        _fail("repository_tuple_invalid")
    expectations = tuple(
        admission.RepoExpectation(
            role,
            root_by_name[repository],
            by_name[repository].commit,
            by_name[repository].tree,
        )
        for role in admission.REPOSITORY_ROLES
        for repository in (_role_repository(role),)
    )
    soc = root_by_name["cybrik-soc-command-center"]
    ai = root_by_name["cybrik-cyber-ai-platform"]
    fabric = root_by_name["cybrik-security-tool-fabric"]
    suite = root_by_name["cybrik-suite"]
    return (
        RepositoryLayout(
            suite=suite,
            soc=soc,
            cyber_ai=ai,
            tool_fabric=fabric,
            soc_source=_exact_directory(
                soc / "services/api/src",
                empty=False,
                reason="repository_sources_invalid",
                mode=None,
            ),
            cyber_ai_api_source=_exact_directory(
                ai / "services/ai-api/src",
                empty=False,
                reason="repository_sources_invalid",
                mode=None,
            ),
            cyber_ai_core_source=_exact_directory(
                ai / "packages/ai-core/src",
                empty=False,
                reason="repository_sources_invalid",
                mode=None,
            ),
            tool_fabric_source=_exact_directory(
                fabric / "src/control-plane",
                empty=False,
                reason="repository_sources_invalid",
                mode=None,
            ),
        ),
        expectations,
    )


def _role_repository(role: str) -> str:
    for repository, observed_role in _REPOSITORY_TO_ROLE.items():
        if observed_role == role:
            return repository
    _fail("repository_tuple_invalid")


def _external_inputs(
    context: object, roots: Sequence[object], repository_roots: Sequence[Path]
) -> tuple[ExternalRoots, str]:
    items = tuple(roots)
    digest = external_roots_digest(items)
    if not hmac.compare_digest(
        digest, _hex(getattr(context, "external_roots_sha256", None))
    ):
        _fail("external_roots_invalid")
    paths = tuple(
        _exact_directory(
            getattr(item, "root", None),
            empty=index >= 2,
            reason="external_roots_invalid",
        )
        for index, item in enumerate(items)
    )
    if len(set(paths)) != len(paths) or any(
        left.is_relative_to(right) or right.is_relative_to(left)
        for index, left in enumerate(paths)
        for right in paths[index + 1 :]
    ):
        _fail("external_roots_invalid")
    master_evidence = context.evidence_root
    protected = (*repository_roots, master_evidence)
    if any(
        left == right or left.is_relative_to(right) or right.is_relative_to(left)
        for left in paths
        for right in protected
    ):
        _fail("external_roots_invalid")
    return ExternalRoots(*paths[2:]), digest


def _runtime_files(
    wheel: object, python: object, expected_python_sha256: object
) -> tuple[Path, Path]:
    b1, b1_payload = _exact_file(wheel, mode=0o600, reason="b1_wheel_invalid")
    if (
        b1.name != B1_WHEEL_FILENAME
        or hashlib.sha256(b1_payload).hexdigest() != B1_WHEEL_SHA256
    ):
        _fail("b1_wheel_invalid")
    expected = _hex(expected_python_sha256)
    if not isinstance(python, Path) or python.is_symlink():
        _fail("python_invalid")
    try:
        mode = stat.S_IMODE(python.stat(follow_symlinks=False).st_mode)
    except OSError:
        _fail("python_invalid")
    if mode not in {0o700, 0o755}:
        _fail("python_invalid")
    pinned, payload = _exact_file(
        python, mode=mode, reason="python_invalid", allow_root_owner=True
    )
    if hashlib.sha256(payload).hexdigest() != expected:
        _fail("python_invalid")
    return b1, pinned


def _forbidden(*_args: object) -> NoReturn:
    _fail("child_authority_forbidden")


def _load_master_allowlist(suite_root: Path) -> Mapping[str, Sequence[str]]:
    source = _exact_directory(
        suite_root / "integration/compose/integrated-uat/src",
        empty=False,
        reason="master_allowlist_invalid",
        mode=None,
    )
    source_text = str(source)
    if source_text not in sys.path:
        sys.path.insert(0, source_text)
    try:
        module = import_module("cybrik_suite_integrated_uat.admission")
        origin = Path(module.__file__).resolve(strict=True)
        allowlist = module.MASTER_TRACKED_ALLOWLIST
    except (AttributeError, ImportError, OSError, TypeError):
        _fail("master_allowlist_invalid")
    if (
        origin != source / "cybrik_suite_integrated_uat/admission.py"
        or not isinstance(allowlist, Mapping)
        or tuple(allowlist) != admission.REPOSITORY_ROLES
        or any(
            not isinstance(paths, Sequence)
            or isinstance(paths, (str, bytes))
            or not paths
            or any(not isinstance(path, str) or not path for path in paths)
            for paths in allowlist.values()
        )
    ):
        _fail("master_allowlist_invalid")
    return allowlist


def build_master_reserved_stage_dependencies(
    *,
    master_context: object,
    repository_roots: Sequence[object],
    external_roots: Sequence[object],
    b1_wheel: Path,
    pinned_python: Path,
    pinned_python_sha256: str,
    adapters: runtime_wiring.WiringAdapters | None = None,
    master_allowlist: Mapping[str, Sequence[str]] | None = None,
) -> MasterReservedStageDependencies:
    """Build the child runtime from one already-consumed master reservation."""

    values = _validate_marker_bindings(master_context)
    repositories, expectations = _repository_inputs(master_context, repository_roots)
    external, external_digest = _external_inputs(
        master_context, external_roots, repositories.roots
    )
    b1, python = _runtime_files(b1_wheel, pinned_python, pinned_python_sha256)
    allowlist = master_allowlist or _load_master_allowlist(repositories.suite)
    selected = adapters or runtime_wiring.WiringAdapters(
        prepare_session=lambda config, binding: runtime_wiring.prepare_concrete_runtime(
            config,
            binding,
            preserve_runtime_root=True,
            tracked_allowlist=allowlist,
        ),
        build_case_wiring=runtime_wiring._build_concrete_cases,
    )
    try:
        observations = selected.observe(expectations)
        aggregate = selected.aggregate(observations, allowlist)
    except Exception:  # noqa: BLE001 - collaborator details stay behind stable codes.
        _fail("master_binding_reobservation_failed")
    expected_observations = tuple(
        admission.RepositoryObservation(item.role, item.root, item.commit, item.tree)
        for item in expectations
    )
    if (
        observations != expected_observations
        or not isinstance(aggregate, admission.TrackedBlobAggregate)
        or aggregate.algorithm != admission.TRACKED_BLOB_ALGORITHM
        or not hmac.compare_digest(aggregate.sha256, values["aggregate_sha256"])
    ):
        _fail("master_binding_mismatch")
    binding = ReservedRuntimeBinding(
        authorization_id=values["run_id"],
        authorization_sha256=values["authorization_sha256"],
        aggregate=aggregate,
        observations=observations,
    )
    config = _ReservedRuntimeConfig(repositories, external, b1, python)
    try:
        session = selected.prepare_session(config, binding)  # type: ignore[arg-type]
        if not isinstance(session, RuntimeSession):
            _fail("runtime_session_invalid")
        case_wiring = selected.build_case_wiring(config, binding, session)  # type: ignore[arg-type]
        if not isinstance(case_wiring, runtime_case_wiring.RuntimeCaseWiring):
            _fail("runtime_case_wiring_invalid")
        cases = runtime_cases.build_case_callbacks(
            runtime_case_wiring.build_runtime_case_dependencies(case_wiring)
        )
    except IntegratedStageFailure:
        raise
    except Exception:  # noqa: BLE001 - runtime details stay behind stable codes.
        _fail("runtime_preparation_failed")
    dependencies = runner.RunnerDependencies(
        authorize=_forbidden,
        start_soc=lambda _binding: session.start("soc"),
        wait_soc_ready=session.wait_ready,
        start_fabric=lambda _binding: session.start("fabric"),
        wait_fabric_ready=session.wait_ready,
        start_ai=lambda _binding: session.start("ai"),
        wait_ai_ready=session.wait_ready,
        run_positive=cases.positive,
        run_f1=cases.f1,
        run_f2=cases.f2,
        stop_ai=session.stop,
        stop_fabric=session.stop,
        stop_soc=session.stop,
        verify_absent=lambda _binding: session.verify_absent(),
        consume_authorization=_forbidden,
        finalize_runtime=lambda _binding: session.finalize(),
        evidence_root_for=_forbidden,
    )
    return MasterReservedStageDependencies(binding, dependencies, external_digest)


def public_receipt(
    context: object, *, external_roots_sha256: str, status: str = "passed"
) -> bytes:
    if status != "passed":
        _fail("stage_receipt_invalid")
    return _canonical(
        {
            "aggregate_sha256": _hex(getattr(context, "aggregate_sha256", None)),
            "external_roots_sha256": _hex(external_roots_sha256),
            "master_authorization_sha256": _hex(
                getattr(context, "authorization_sha256", None)
            ),
            "master_marker_sha256": _hex(getattr(context, "marker_sha256", None)),
            "repository_roots_sha256": _hex(
                getattr(context, "repository_roots_sha256", None)
            ),
            "repository_tuple_sha256": _hex(
                getattr(context, "repository_tuple_sha256", None)
            ),
            "run_id": _hex(getattr(context, "run_id", None), _RUN_ID),
            "schema": "cybrik.integrated-uat.public-stage-receipt/v1",
            "stage": "alert_context",
            "status": status,
        }
    )


def absence_receipt(context: object, *, external_roots_sha256: str) -> bytes:
    return _canonical(
        {
            "absent": True,
            "aggregate_sha256": _hex(getattr(context, "aggregate_sha256", None)),
            "authorization_sha256": _hex(
                getattr(context, "authorization_sha256", None)
            ),
            "external_roots_sha256": _hex(external_roots_sha256),
            "marker_sha256": _hex(getattr(context, "marker_sha256", None)),
            "repository_roots_sha256": _hex(
                getattr(context, "repository_roots_sha256", None)
            ),
            "repository_tuple_sha256": _hex(
                getattr(context, "repository_tuple_sha256", None)
            ),
            "run_id": _hex(getattr(context, "run_id", None), _RUN_ID),
            "schema": "cybrik.integrated-uat.absence/v1",
            "scope": "alert_context",
        }
    )


def _parse_bindings(
    values: Sequence[str], expected: Sequence[str], reason: str
) -> dict[str, str]:
    return _cli._parse_bindings(values, expected, reason)


def _arguments(argv: Sequence[str] | None):
    return _cli._arguments(argv)


def _command_inputs(arguments: object):
    return _cli._command_inputs(arguments)  # type: ignore[arg-type]


main = _cli.main


__all__ = [
    "EXPECTED_EXTERNAL_CAPABILITIES",
    "EXPECTED_REPOSITORIES",
    "IntegratedStageFailure",
    "MasterReservedStageDependencies",
    "ReservedRuntimeBinding",
    "absence_receipt",
    "build_master_reserved_stage_dependencies",
    "external_roots_digest",
    "main",
    "public_receipt",
    "repository_roots_digest",
]
