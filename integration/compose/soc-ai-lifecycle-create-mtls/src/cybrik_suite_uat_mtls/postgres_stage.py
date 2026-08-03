"""Non-consuming PostgreSQL D2 stage seam for a master UAT authority.

The adapter accepts only an already-consumed, externally stored master
reservation.  It never creates or verifies the legacy D2 child-consumption
marker and never asks the legacy terminal handoff to write a child terminal.
Standalone D2 continues to use :mod:`harness` directly.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import stat
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final, NoReturn

from . import harness, runtime_authorization

STAGE_NAME: Final = "postgres_d2"
RECEIPT_SCHEMA: Final = "cybrik.integrated-uat.postgres-d2-stage-receipt.v1"
MASTER_MARKER_NAME: Final = ".cybrik-integrated-uat-consumed.json"
MAX_MASTER_MARKER_BYTES: Final = 16 * 1024

_HEX40 = re.compile(r"[0-9a-f]{40}")
_HEX64 = re.compile(r"[0-9a-f]{64}")
_RUN_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,127}")
_REPOSITORIES: Final = (
    "cybrik-soc-command-center",
    "cybrik-cyber-ai-platform",
    "cybrik-security-tool-fabric",
    "cybrik-suite",
)
_EXTERNAL_ROOT_ROLES: Final = (
    "postgres_d2_runtime",
    "postgres_d2_evidence",
    "alert_context_runtime",
    "alert_context_evidence",
    "alert_context_state",
)
_ROLE_TO_REPOSITORY: Final = {
    "soc": "cybrik-soc-command-center",
    "ai": "cybrik-cyber-ai-platform",
    "fabric": "cybrik-security-tool-fabric",
    "suite": "cybrik-suite",
}
_ABSENCE_FIELDS: Final = (
    "completed",
    "ai_process_absent",
    "soc_process_absent",
    "postgres_container_absent",
    "ai_listener_absent",
    "postgres_listener_absent",
    "runtime_root_absent",
    "pki_absent",
    "control_root_absent",
)


class StageFailure(RuntimeError):
    """Stable stage refusal that does not expose caller-controlled material."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _fail(reason: str) -> NoReturn:
    raise StageFailure(reason)


def canonical_receipt_bytes(document: object) -> bytes:
    """Return the one canonical receipt representation used by the digest."""

    try:
        return (
            json.dumps(
                document,
                allow_nan=False,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            )
            + "\n"
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError):
        _fail("stage_receipt_invalid")


@dataclass(frozen=True, slots=True)
class StageOperations:
    """Effect seams; the default set delegates to the existing D2 harness."""

    authorize: Callable[[runtime_authorization.MasterReservationFacts], object]
    observe_repository_tuple: Callable[[object], Mapping[str, Mapping[str, object]]]
    prepare: Callable[[object], object]
    start: Callable[[object], None]
    seed: Callable[[object], None]
    reset: Callable[[object], None]
    run_attempt: Callable[[object], Mapping[str, object]]
    teardown: Callable[[object], None]
    inspect_absence: Callable[[object], Mapping[str, bool]]


@dataclass(frozen=True, slots=True)
class StageAbsence:
    completed: bool
    ai_process_absent: bool
    soc_process_absent: bool
    postgres_container_absent: bool
    ai_listener_absent: bool
    postgres_listener_absent: bool
    runtime_root_absent: bool
    pki_absent: bool
    control_root_absent: bool

    def to_record(self) -> dict[str, bool]:
        return {name: getattr(self, name) for name in _ABSENCE_FIELDS}


@dataclass(frozen=True, slots=True)
class StageReceipt:
    """Path-free receipt accepted structurally by the master orchestrator."""

    aggregate_sha256: str
    receipt_sha256: str
    repository_tuple_sha256: str
    stage: str
    run_id: str
    master_authorization_sha256: str
    master_marker_sha256: str
    stage_authorization_sha256: str
    external_roots_sha256: str
    exact_head_grant_sha256: str
    pki_root_sha256: str
    repository_roots_sha256: str
    summary_sha256: str
    repository_tuple: tuple[tuple[str, str, str], ...]

    def to_record(self) -> dict[str, object]:
        return {
            "aggregate_sha256": self.aggregate_sha256,
            "external_roots_sha256": self.external_roots_sha256,
            "exact_head_grant_sha256": self.exact_head_grant_sha256,
            "master_authorization_sha256": self.master_authorization_sha256,
            "master_marker_sha256": self.master_marker_sha256,
            "pki_root_sha256": self.pki_root_sha256,
            "repository_tuple": [
                {"commit": commit, "repository": repository, "tree": tree}
                for repository, commit, tree in self.repository_tuple
            ],
            "repository_tuple_sha256": self.repository_tuple_sha256,
            "repository_roots_sha256": self.repository_roots_sha256,
            "run_id": self.run_id,
            "schema": RECEIPT_SCHEMA,
            "stage": self.stage,
            "stage_authorization_sha256": self.stage_authorization_sha256,
            "summary_sha256": self.summary_sha256,
        }

    def public_record(self) -> dict[str, object]:
        return {**self.to_record(), "receipt_sha256": self.receipt_sha256}


def _text(value: object, pattern: re.Pattern[str]) -> str:
    if not isinstance(value, str) or pattern.fullmatch(value) is None:
        _fail("master_reservation_invalid")
    return value


def _repository_tuple(value: object) -> tuple[tuple[str, str, str], ...]:
    if not isinstance(value, tuple) or len(value) != len(_REPOSITORIES):
        _fail("master_reservation_invalid")
    records: list[tuple[str, str, str]] = []
    for expected_name, item in zip(_REPOSITORIES, value, strict=True):
        repository = getattr(item, "repository", None)
        commit = getattr(item, "commit", None)
        tree = getattr(item, "tree", None)
        if (
            repository != expected_name
            or getattr(item, "clean", None) is not True
            or not isinstance(commit, str)
            or _HEX40.fullmatch(commit) is None
            or not isinstance(tree, str)
            or _HEX40.fullmatch(tree) is None
        ):
            _fail("master_reservation_invalid")
        records.append((repository, commit, tree))
    return tuple(records)


def _repository_tuple_sha256(
    identities: tuple[tuple[str, str, str], ...],
) -> str:
    payload = canonical_receipt_bytes(
        [
            {
                "clean": True,
                "commit": commit,
                "repository": repository,
                "tree": tree,
            }
            for repository, commit, tree in identities
        ]
    )
    return hashlib.sha256(payload).hexdigest()


def _external_roots(
    value: object,
) -> tuple[tuple[str, Path], ...]:
    if not isinstance(value, tuple) or len(value) != len(_EXTERNAL_ROOT_ROLES):
        _fail("master_reservation_invalid")
    result: list[tuple[str, Path]] = []
    observed_paths: set[Path] = set()
    for expected_role, item in zip(_EXTERNAL_ROOT_ROLES, value, strict=True):
        role = getattr(item, "capability", None)
        root = getattr(item, "root", None)
        if (
            role != expected_role
            or not isinstance(root, Path)
            or not root.is_absolute()
        ):
            _fail("master_reservation_invalid")
        try:
            canonical_parent = root.parent.resolve(strict=True)
        except OSError:
            _fail("master_reservation_invalid")
        canonical = canonical_parent / root.name
        if canonical != root or root in observed_paths:
            _fail("master_reservation_invalid")
        observed_paths.add(root)
        result.append((role, root))
    return tuple(result)


def _external_roots_sha256(roots: tuple[tuple[str, Path], ...]) -> str:
    return hashlib.sha256(
        canonical_receipt_bytes(
            [{"capability": role, "root": str(root)} for role, root in roots]
        )
    ).hexdigest()


def _repository_roots(value: object) -> tuple[tuple[str, Path], ...]:
    if not isinstance(value, tuple) or len(value) != len(_REPOSITORIES):
        _fail("master_reservation_invalid")
    result: list[tuple[str, Path]] = []
    for expected, item in zip(_REPOSITORIES, value, strict=True):
        repository = getattr(item, "repository", None)
        root = getattr(item, "root", None)
        if (
            repository != expected
            or not isinstance(root, Path)
            or not root.is_absolute()
        ):
            _fail("master_reservation_invalid")
        try:
            if root.resolve(strict=True) != root or not root.is_dir():
                _fail("master_reservation_invalid")
        except OSError:
            _fail("master_reservation_invalid")
        result.append((repository, root))
    return tuple(result)


def _repository_roots_sha256(roots: tuple[tuple[str, Path], ...]) -> str:
    return hashlib.sha256(
        canonical_receipt_bytes(
            [
                {"repository": repository, "root": str(root)}
                for repository, root in roots
            ]
        )
    ).hexdigest()


def _read_master_marker(path: Path) -> tuple[bytes, Mapping[str, object]]:
    descriptor = -1
    try:
        descriptor = os.open(
            path,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
        )
        identity = os.fstat(descriptor)
        chunks: list[bytes] = []
        remaining = MAX_MASTER_MARKER_BYTES + 1
        while remaining:
            chunk = os.read(descriptor, remaining)
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
    except (OSError, TypeError, ValueError):
        _fail("master_reservation_invalid")
    finally:
        if descriptor >= 0:
            os.close(descriptor)
    payload = b"".join(chunks)
    if (
        len(payload) == 0
        or len(payload) > MAX_MASTER_MARKER_BYTES
        or not stat.S_ISREG(identity.st_mode)
        or stat.S_IMODE(identity.st_mode) != 0o600
        or identity.st_uid != os.geteuid()
        or identity.st_nlink != 1
    ):
        _fail("master_reservation_invalid")
    try:
        document = json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        _fail("master_reservation_invalid")
    if not isinstance(document, dict) or canonical_receipt_bytes(document) != payload:
        _fail("master_reservation_invalid")
    return payload, document


def _bind_master_reservation(
    context: object,
    *,
    external_root_bindings: object,
    repository_root_bindings: object,
) -> runtime_authorization.MasterReservationFacts:
    aggregate = _text(getattr(context, "aggregate_sha256", None), _HEX64)
    authorization_sha = _text(getattr(context, "authorization_sha256", None), _HEX64)
    marker_sha = _text(getattr(context, "marker_sha256", None), _HEX64)
    tuple_sha = _text(getattr(context, "repository_tuple_sha256", None), _HEX64)
    repository_roots_sha = _text(
        getattr(context, "repository_roots_sha256", None), _HEX64
    )
    external_roots_sha = _text(getattr(context, "external_roots_sha256", None), _HEX64)
    run_id = _text(getattr(context, "run_id", None), _RUN_ID)
    evidence_root = getattr(context, "evidence_root", None)
    marker = getattr(context, "consumption_marker", None)
    authorization_file = getattr(context, "master_authorization_file", None)
    authorization_signature = getattr(context, "master_authorization_signature", None)
    allowed_signers_file = getattr(context, "master_allowed_signers", None)
    if (
        not isinstance(evidence_root, Path)
        or not evidence_root.is_absolute()
        or not isinstance(marker, Path)
        or marker != evidence_root / MASTER_MARKER_NAME
        or any(
            not isinstance(path, Path) or not path.is_absolute()
            for path in (
                authorization_file,
                authorization_signature,
                allowed_signers_file,
            )
        )
    ):
        _fail("master_reservation_invalid")
    try:
        root_identity = evidence_root.lstat()
        if evidence_root.resolve(strict=True) != evidence_root:
            _fail("master_reservation_invalid")
    except OSError:
        _fail("master_reservation_invalid")
    if (
        not stat.S_ISDIR(root_identity.st_mode)
        or stat.S_IMODE(root_identity.st_mode) != 0o700
        or root_identity.st_uid != os.geteuid()
    ):
        _fail("master_reservation_invalid")
    identities = _repository_tuple(getattr(context, "repository_tuple", None))
    if not hmac.compare_digest(_repository_tuple_sha256(identities), tuple_sha):
        _fail("master_reservation_invalid")
    external_roots = _external_roots(external_root_bindings)
    if not hmac.compare_digest(
        _external_roots_sha256(external_roots), external_roots_sha
    ):
        _fail("master_reservation_invalid")
    roots_by_role = dict(external_roots)
    postgres_runtime_root = roots_by_role["postgres_d2_runtime"]
    postgres_evidence_root = roots_by_role["postgres_d2_evidence"]
    if (
        postgres_runtime_root == postgres_evidence_root
        or evidence_root in postgres_runtime_root.parents
        or evidence_root in postgres_evidence_root.parents
        or postgres_runtime_root in evidence_root.parents
        or postgres_evidence_root in evidence_root.parents
    ):
        _fail("master_reservation_invalid")
    repository_roots = _repository_roots(repository_root_bindings)
    if not hmac.compare_digest(
        _repository_roots_sha256(repository_roots), repository_roots_sha
    ):
        _fail("master_reservation_invalid")
    payload, document = _read_master_marker(marker)
    expected_keys = {
        "aggregate_sha256",
        "authorization_sha256",
        "external_roots_sha256",
        "exact_head_grant_sha256",
        "one_shot",
        "repository_roots_sha256",
        "repository_tuple_sha256",
        "run_id",
        "status",
    }
    if (
        set(document) != expected_keys
        or document.get("aggregate_sha256") != aggregate
        or document.get("authorization_sha256") != authorization_sha
        or document.get("external_roots_sha256") != external_roots_sha
        or _HEX64.fullmatch(str(document.get("exact_head_grant_sha256", ""))) is None
        or document.get("one_shot") is not True
        or document.get("repository_roots_sha256") != repository_roots_sha
        or document.get("repository_tuple_sha256") != tuple_sha
        or document.get("run_id") != run_id
        or document.get("status") != "consumed"
        or not hmac.compare_digest(hashlib.sha256(payload).hexdigest(), marker_sha)
    ):
        _fail("master_reservation_invalid")
    return runtime_authorization.MasterReservationFacts(
        aggregate_sha256=aggregate,
        authorization_file=authorization_file,
        authorization_sha256=authorization_sha,
        authorization_signature=authorization_signature,
        allowed_signers_file=allowed_signers_file,
        external_roots=external_roots,
        external_roots_sha256=external_roots_sha,
        exact_head_grant_sha256=str(document["exact_head_grant_sha256"]),
        master_evidence_root=evidence_root,
        marker_sha256=marker_sha,
        postgres_evidence_root=postgres_evidence_root,
        postgres_runtime_root=postgres_runtime_root,
        repository_roots=repository_roots,
        repository_roots_sha256=repository_roots_sha,
        repository_tuple=identities,
        repository_tuple_sha256=tuple_sha,
        run_id=run_id,
    )


def _observe_exact_tuple(
    observed: object, reservation: runtime_authorization.MasterReservationFacts
) -> tuple[tuple[str, str, str], ...]:
    if not isinstance(observed, Mapping) or set(observed) != set(_ROLE_TO_REPOSITORY):
        _fail("repository_tuple_mismatch")
    by_name = {
        name: (commit, tree) for name, commit, tree in reservation.repository_tuple
    }
    for role, repository in _ROLE_TO_REPOSITORY.items():
        identity = observed.get(role)
        expected = by_name[repository]
        if (
            not isinstance(identity, Mapping)
            or set(identity) != {"clean", "commit_sha", "tree_sha"}
            or identity.get("clean") is not True
            or (identity.get("commit_sha"), identity.get("tree_sha")) != expected
        ):
            _fail("repository_tuple_mismatch")
    return reservation.repository_tuple


def _default_operations() -> StageOperations:
    return StageOperations(
        authorize=runtime_authorization.authorize_from_master_reservation,
        observe_repository_tuple=harness._stage_repository_tuple,
        prepare=runtime_authorization.prepare_master_stage_roots,
        start=harness._stage_start,
        seed=harness._stage_seed,
        reset=harness._stage_reset,
        run_attempt=harness._stage_run_runtime_attempt,
        teardown=harness._stage_teardown,
        inspect_absence=harness._stage_absence_state,
    )


class PostgresD2StageAdapter:
    """Structural adapter for the integrated orchestrator's PostgreSQL stage."""

    __slots__ = ("_external_roots", "_operations", "_repository_roots")

    def __init__(
        self,
        operations: StageOperations | None = None,
        *,
        external_roots: object,
        repository_roots: object,
    ) -> None:
        if operations is not None and not isinstance(operations, StageOperations):
            raise TypeError("operations must be StageOperations")
        object.__setattr__(self, "_operations", operations or _default_operations())
        object.__setattr__(self, "_external_roots", external_roots)
        object.__setattr__(self, "_repository_roots", repository_roots)

    def _admitted(
        self, context: object
    ) -> tuple[runtime_authorization.MasterReservationFacts, object]:
        reservation = _bind_master_reservation(
            context,
            external_root_bindings=self._external_roots,
            repository_root_bindings=self._repository_roots,
        )
        try:
            authorization = self._operations.authorize(reservation)
            observed = self._operations.observe_repository_tuple(authorization)
        except Exception:  # noqa: BLE001 - collapse all adapter failures at the boundary.
            _fail("postgres_d2_stage_admission_failed")
        _observe_exact_tuple(observed, reservation)
        stage_sha = getattr(authorization, "authorization_sha256", None)
        if (
            not isinstance(stage_sha, str)
            or stage_sha != reservation.authorization_sha256
        ):
            _fail("postgres_d2_stage_admission_failed")
        return reservation, authorization

    def run(self, context: object) -> StageReceipt:
        reservation, authorization = self._admitted(context)
        try:
            authorization = self._operations.prepare(authorization)
            self._operations.start(authorization)
            self._operations.seed(authorization)
            self._operations.reset(authorization)
            summary = self._operations.run_attempt(authorization)
        except Exception:  # noqa: BLE001 - collapse all adapter failures at the boundary.
            _fail("postgres_d2_stage_failed")
        if not isinstance(summary, Mapping):
            _fail("postgres_d2_stage_failed")
        summary_sha = hashlib.sha256(canonical_receipt_bytes(dict(summary))).hexdigest()
        stage_sha = str(authorization.authorization_sha256)
        runtime_root = getattr(authorization, "runtime_root", None)
        if not isinstance(runtime_root, Path):
            _fail("postgres_d2_stage_failed")
        pki_root_sha = hashlib.sha256(
            (
                str(runtime_root / runtime_authorization.PREPARED_PKI_LEAF) + "\n"
            ).encode()
        ).hexdigest()
        unsigned = StageReceipt(
            aggregate_sha256=reservation.aggregate_sha256,
            receipt_sha256="",
            repository_tuple_sha256=reservation.repository_tuple_sha256,
            stage=STAGE_NAME,
            run_id=reservation.run_id,
            master_authorization_sha256=reservation.authorization_sha256,
            master_marker_sha256=reservation.marker_sha256,
            stage_authorization_sha256=stage_sha,
            external_roots_sha256=reservation.external_roots_sha256,
            exact_head_grant_sha256=reservation.exact_head_grant_sha256,
            pki_root_sha256=pki_root_sha,
            repository_roots_sha256=reservation.repository_roots_sha256,
            summary_sha256=summary_sha,
            repository_tuple=reservation.repository_tuple,
        )
        receipt_sha = hashlib.sha256(
            canonical_receipt_bytes(unsigned.to_record())
        ).hexdigest()
        return StageReceipt(
            aggregate_sha256=unsigned.aggregate_sha256,
            receipt_sha256=receipt_sha,
            repository_tuple_sha256=unsigned.repository_tuple_sha256,
            stage=unsigned.stage,
            run_id=unsigned.run_id,
            master_authorization_sha256=unsigned.master_authorization_sha256,
            master_marker_sha256=unsigned.master_marker_sha256,
            stage_authorization_sha256=unsigned.stage_authorization_sha256,
            external_roots_sha256=unsigned.external_roots_sha256,
            exact_head_grant_sha256=unsigned.exact_head_grant_sha256,
            pki_root_sha256=unsigned.pki_root_sha256,
            repository_roots_sha256=unsigned.repository_roots_sha256,
            summary_sha256=unsigned.summary_sha256,
            repository_tuple=unsigned.repository_tuple,
        )

    def teardown(self, context: object) -> None:
        _reservation, authorization = self._admitted(context)
        try:
            self._operations.teardown(authorization)
        except Exception:  # noqa: BLE001 - collapse all adapter failures at the boundary.
            _fail("postgres_d2_teardown_failed")

    def inspect_absence(self, context: object) -> StageAbsence:
        _reservation, authorization = self._admitted(context)
        try:
            observed = self._operations.inspect_absence(authorization)
        except Exception:  # noqa: BLE001 - collapse all adapter failures at the boundary.
            _fail("stage_absence_observation_failed")
        if not isinstance(observed, Mapping) or set(observed) != set(_ABSENCE_FIELDS):
            _fail("stage_absence_observation_failed")
        values = {name: observed[name] for name in _ABSENCE_FIELDS}
        if any(not isinstance(value, bool) for value in values.values()):
            _fail("stage_absence_observation_failed")
        return StageAbsence(**values)

    def verify_absent(self, context: object) -> None:
        if not all(self.inspect_absence(context).to_record().values()):
            _fail("stage_residual_present")


__all__ = [
    "PostgresD2StageAdapter",
    "StageAbsence",
    "StageFailure",
    "StageOperations",
    "StageReceipt",
    "canonical_receipt_bytes",
]
