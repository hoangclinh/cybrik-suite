"""Fail-closed authorization boundary for the single D2 runtime attempt.

The committed authorization binds an admitted Suite ancestor and the runtime
surface.  A separate, external, digest-pinned post-commit grant binds that
authorization to the exact final Suite HEAD and aggregate without creating a
Git self-reference.  Importing this module is inert and every helper is
suitable for synthetic, no-network unit tests.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import MappingProxyType
from typing import Final, Never

from . import policy

BINDING_VERSION: Final = "CYBRIK-D2-RUNTIME-AUTH/v1"
EXACT_HEAD_GRANT_VERSION: Final = "CYBRIK-D2-EXACT-HEAD-GRANT/v2"
EXACT_HEAD_GRANT_SIGNER_IDENTITY: Final = "cybrik-codex-governor"
EXACT_HEAD_GRANT_NAMESPACE: Final = "cybrik-d2-exact-head-grant"
EXACT_HEAD_GRANT_VERIFY_BINARY: Final = Path("/usr/bin/ssh-keygen")
MAX_ALLOWED_SIGNERS_BYTES: Final = 16 * 1024
MAX_AUTHORIZATION_BYTES: Final = 64 * 1024
MAX_MASTER_B1_WHEEL_BYTES: Final = 64 * 1024 * 1024
MAX_CANDIDATE_BYTES: Final = 1024 * 1024
MAX_CONSUMPTION_MARKER_BYTES: Final = 16 * 1024
MAX_ADMISSION_ARTIFACT_BYTES: Final = 64 * 1024
MASTER_RESERVATION_SCHEMA: Final = "CYBRIK-D2-MASTER-RESERVATION/v1"
MASTER_CONSUMPTION_MARKER: Final = ".cybrik-integrated-uat-consumed.json"
MASTER_AUTHORIZATION_SCHEMA: Final = "CYBRIK-INTEGRATED-UAT-MASTER-AUTH/v1"
MASTER_AUTHORIZATION_NAMESPACE: Final = "cybrik-uat-soc-ai-fabric-v1"
MASTER_TRUST_DESCRIPTOR_REL: Final = Path(
    "integration/compose/soc-ai-fabric-alert-context-mtls/authorization-trust.json"
)
AGGREGATE_ALGORITHM: Final = "cybrik-runtime-code-sha256-lines/v1"
CONSUMPTION_MARKER: Final = ".cybrik-d2-runtime-consumed.json"
ROLLBACK_POLICY: Final = "verify-marker-if-present-then-teardown-and-verify-absent"

COVERAGE_RECEIPT_POLICY_ID: Final = "cybrik-d2-coverage-receipt/v2"
COVERAGE_MEASUREMENT_RECEIPT_SCHEMA: Final = "2.0.0"
COVERAGE_PRODUCER_IDENTITY: Final = "cybrik-d2-coverage-wrapper"
COVERAGE_ADMISSIBLE_STATUS: Final = "PASS"
ROOT_PREPARATION_SCHEMA_VERSION: Final = "CYBRIK-D2-ROOT-PREPARATION/v1"
PREPARED_ROOT_MODE: Final = "0700"
PREPARED_ROOT_ROLES: Final = ("evidence", "pki", "runtime")
PREPARED_PKI_LEAF: Final = "pki"
PREPARED_ROOT_INITIAL_INVENTORY: Final = MappingProxyType(
    {
        "evidence": (),
        "pki": (),
        "runtime": (PREPARED_PKI_LEAF,),
    }
)
ADMISSION_BINDING_MISMATCH: Final = "admission_artifact_binding_mismatch"
PREPARED_RUNTIME_ROOT_MISMATCH: Final = "prepared_runtime_root_mismatch"
ADMISSION_ARTIFACT_ENVIRONMENT: Final = MappingProxyType(
    {
        "coverage_authorization_bytes": "CYBRIK_UAT_D2_COVERAGE_AUTHORIZATION",
        "measurement_receipt_bytes": "CYBRIK_UAT_D2_COVERAGE_MEASUREMENT_RECEIPT",
        "coverage_pass_result_bytes": "CYBRIK_UAT_D2_COVERAGE_GATE_RESULT",
        "root_preparation_receipt_bytes": ("CYBRIK_UAT_D2_ROOT_PREPARATION_RECEIPT"),
    }
)

AUTHORIZATION_REL: Final = Path(
    "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/"
    "evidence/04-runtime-authorization.md"
)
CANDIDATE_REL: Final = Path(
    "docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/"
    "runtime-admission.json"
)

_SOURCE_ROOT = "integration/compose/soc-ai-lifecycle-create-mtls/src"
_PACKAGE = f"{_SOURCE_ROOT}/cybrik_suite_uat_mtls"
_GIT_ENV: Final = MappingProxyType(
    {
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_NOSYSTEM": "1",
        "LC_ALL": "C",
        "PATH": "/usr/bin:/bin",
    }
)
RUNTIME_CODE_PATHS: Final = tuple(
    sorted(
        (
            f"{_PACKAGE}/__init__.py",
            f"{_PACKAGE}/callable_fabric_rehearsal.py",
            f"{_PACKAGE}/client.py",
            f"{_PACKAGE}/evidence.py",
            f"{_PACKAGE}/harness.py",
            f"{_PACKAGE}/pki.py",
            f"{_PACKAGE}/policy.py",
            f"{_PACKAGE}/postgres_stage.py",
            f"{_PACKAGE}/procedure.py",
            f"{_PACKAGE}/process_control.py",
            f"{_PACKAGE}/process_supervisor.py",
            f"{_PACKAGE}/runtime_authorization.py",
            f"{_PACKAGE}/runtime_evidence.py",
            f"{_PACKAGE}/secret_inventory.py",
            f"{_PACKAGE}/server.py",
            f"{_PACKAGE}/store.py",
            f"{_PACKAGE}/terminal_integration.py",
            "integration/compose/soc-ai-lifecycle-create-mtls/pyproject.toml",
            (
                "integration/compose/soc-ai-lifecycle-create-mtls/tests/"
                "test_lifecycle_runtime.py"
            ),
            (
                "integration/compose/soc-ai-lifecycle-create-mtls/tests/"
                "test_postgres_stage.py"
            ),
            (
                "integration/compose/soc-ai-lifecycle-create-mtls/scripts/"
                "integrated_uat_stage.py"
            ),
            "tests/e2e/run-soc-ai-lifecycle-create-mtls-uat.sh",
        )
    )
)
MUST_BE_ABSENT_RUNTIME_PATHS: Final = tuple(
    sorted(
        (
            "conftest.py",
            "integration/compose/soc-ai-lifecycle-create-mtls/conftest.py",
            f"{_SOURCE_ROOT}/cybrik_ai_api",
            f"{_SOURCE_ROOT}/cybrik_ai_core",
            f"{_SOURCE_ROOT}/cybrik_soc",
            f"{_SOURCE_ROOT}/sitecustomize.py",
            f"{_SOURCE_ROOT}/usercustomize.py",
            "integration/compose/soc-ai-lifecycle-create-mtls/tests/conftest.py",
            "tests/conftest.py",
        )
    )
)
RUNTIME_SOURCE_TREE_PATHS: Final = tuple(
    sorted(
        {
            "cybrik_suite_uat_mtls",
            *(
                Path(relative).relative_to(_SOURCE_ROOT).as_posix()
                for relative in RUNTIME_CODE_PATHS
                if relative.startswith(f"{_SOURCE_ROOT}/")
            ),
        }
    )
)

IMPORT_SOURCE_ROOTS: Final = (
    ("suite", Path("integration/compose/soc-ai-lifecycle-create-mtls/src")),
    ("soc", Path("services/api/src")),
    ("cyber_ai", Path("packages/ai-core/src")),
    ("cyber_ai", Path("services/ai-api/src")),
)
MODULE_ORIGIN_ROOTS: Final = MappingProxyType(
    {
        "cybrik_suite_uat_mtls": (
            "suite",
            Path(
                "integration/compose/soc-ai-lifecycle-create-mtls/src/"
                "cybrik_suite_uat_mtls"
            ),
        ),
        "cybrik_soc": ("soc", Path("services/api/src/cybrik_soc")),
        "cybrik_ai_core": (
            "cyber_ai",
            Path("packages/ai-core/src/cybrik_ai_core"),
        ),
        "cybrik_ai_api": (
            "cyber_ai",
            Path("services/ai-api/src/cybrik_ai_api"),
        ),
    }
)

EXPECTED_FIELDS: Final = (
    "D2_RUNTIME_AUTHORIZATION",
    "AUTHORIZATION_ID",
    "AUTHORIZED_BY",
    "AUTHORIZED_AT",
    "AUTHORIZATION_EXPIRES_AT",
    "BINDING_VERSION",
    "EXACT_HEAD_GRANT_ALLOWED_SIGNERS_SHA256",
    "SUITE_ROOT",
    "SUITE_ADMISSION_BASE",
    "RUNTIME_CODE_AGGREGATE_ALGORITHM",
    "RUNTIME_CODE_AGGREGATE_FILE_COUNT",
    "RUNTIME_CODE_AGGREGATE_SHA256",
    "B1_WHEEL_SHA256",
    "RUNTIME_ROOT",
    "EVIDENCE_ROOT",
    "SOC_ROOT",
    "SOC_COMMIT",
    "SOC_TREE",
    "CYBER_AI_ROOT",
    "CYBER_AI_COMMIT",
    "CYBER_AI_TREE",
    "TOOL_FABRIC_ROOT",
    "TOOL_FABRIC_COMMIT",
    "TOOL_FABRIC_TREE",
    "ONE_SHOT",
    "CONSUMPTION_MARKER",
    "ROLLBACK",
)
EXACT_HEAD_GRANT_FIELDS: Final = (
    "D2_EXACT_HEAD_GRANT",
    "AUTHORIZED_BY",
    "GRANT_VERSION",
    "AUTHORIZATION_SHA256",
    "SUITE_HEAD",
    "SUITE_TREE",
    "RUNTIME_CODE_AGGREGATE_SHA256",
    "COVERAGE_AUTHORIZATION_SHA256",
    "COVERAGE_MEASUREMENT_RECEIPT_SHA256",
    "COVERAGE_GATE_RESULT_SHA256",
    "ROOT_PREPARATION_RECEIPT_SHA256",
)
EXACT_HEAD_GRANT_DIGEST_FIELDS: Final = (
    "AUTHORIZATION_SHA256",
    "RUNTIME_CODE_AGGREGATE_SHA256",
    "COVERAGE_AUTHORIZATION_SHA256",
    "COVERAGE_MEASUREMENT_RECEIPT_SHA256",
    "COVERAGE_GATE_RESULT_SHA256",
    "ROOT_PREPARATION_RECEIPT_SHA256",
)
EXACT_HEAD_GRANT_PINNED_VALUES: Final = MappingProxyType(
    {
        "D2_EXACT_HEAD_GRANT": "APPROVE",
        "AUTHORIZED_BY": "CODEX-GOVERNOR",
        "GRANT_VERSION": EXACT_HEAD_GRANT_VERSION,
    }
)

_PRODUCT_IDENTITIES: Final = MappingProxyType(
    {
        "soc": (
            "abfdfde96afc6daa2868694de993c623daa8862e",
            "241ef24a33246918ff5cf133e7d8d004823fdf06",
        ),
        "cyber_ai": (
            "789614144686dab88500dd2bfecdd608ef0a8b8f",
            "244140e3aacd783b1bea7542f9f56ffc46cedc86",
        ),
        "tool_fabric": (
            "49583be00235a0f8ad7da8cb4ea99108ad201a69",
            "ca8b4a03116bea979de89b92b2f8fef4fd31e001",
        ),
    }
)
PINNED_VALUES: Final = MappingProxyType(
    {
        "D2_RUNTIME_AUTHORIZATION": "APPROVE",
        "AUTHORIZED_BY": "FOUNDER",
        "BINDING_VERSION": BINDING_VERSION,
        "RUNTIME_CODE_AGGREGATE_ALGORITHM": AGGREGATE_ALGORITHM,
        "RUNTIME_CODE_AGGREGATE_FILE_COUNT": str(len(RUNTIME_CODE_PATHS)),
        "B1_WHEEL_SHA256": policy.PINNED_B1_WHEEL_SHA256,
        "SOC_COMMIT": _PRODUCT_IDENTITIES["soc"][0],
        "SOC_TREE": _PRODUCT_IDENTITIES["soc"][1],
        "CYBER_AI_COMMIT": _PRODUCT_IDENTITIES["cyber_ai"][0],
        "CYBER_AI_TREE": _PRODUCT_IDENTITIES["cyber_ai"][1],
        "TOOL_FABRIC_COMMIT": _PRODUCT_IDENTITIES["tool_fabric"][0],
        "TOOL_FABRIC_TREE": _PRODUCT_IDENTITIES["tool_fabric"][1],
        "ONE_SHOT": "true",
        "CONSUMPTION_MARKER": CONSUMPTION_MARKER,
        "ROLLBACK": ROLLBACK_POLICY,
    }
)

_HEX40 = re.compile(r"[0-9a-f]{40}")
_HEX64 = re.compile(r"[0-9a-f]{64}")
_MASTER_RUN_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,127}")
_DIRECTORY_MODE = re.compile(r"0[0-7]{3}")
_AUTHORIZATION_ID = re.compile(r"[a-z0-9][a-z0-9._-]{0,127}")
_EXACT_HEAD_GRANT_NAME = re.compile(
    r"cybrik-uat-d2-exact-head-grant-[a-z0-9][a-z0-9._-]{0,63}\.txt"
)
_EXACT_HEAD_GRANT_SIGNATURE_NAME = re.compile(
    r"cybrik-uat-d2-exact-head-grant-[a-z0-9][a-z0-9._-]{0,63}\.txt\.sig"
)
_EXACT_HEAD_ALLOWED_SIGNERS_NAME = re.compile(
    r"cybrik-uat-d2-exact-head-allowed-signers-"
    r"[a-z0-9][a-z0-9._-]{0,63}\.txt"
)
_ROOT_NAMES: Final = {
    "RUNTIME_ROOT": re.compile(r"cybrik-uat-d2-runtime-[a-z0-9][a-z0-9._-]{0,63}"),
    "EVIDENCE_ROOT": re.compile(r"cybrik-uat-d2-evidence-[a-z0-9][a-z0-9._-]{0,63}"),
}
_D1_BASE: Final = "a2ba11760919021158c3d48aeaa27645af3464da"
_MAX_WINDOW: Final = timedelta(hours=24)


class RuntimeAuthorizationFailure(RuntimeError):
    """A stable, non-reflecting refusal from the runtime boundary."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class CandidateState:
    status: object
    execution_authorized: object
    executed_checks: object
    passed_checks: object
    failed_checks: object
    authorization_sha256: object


@dataclass(frozen=True)
class ObservedProduct:
    role: str
    root: Path
    commit: str
    tree: str
    detached: bool
    status: str


@dataclass(frozen=True)
class DirectoryIdentity:
    """The signed, immutable identity of one prepared runtime directory."""

    mode: str
    st_dev: int
    st_ino: int
    uid: int


@dataclass(frozen=True)
class RootBinding:
    """One prepared root: its declared path, signed identity and inventory."""

    role: str
    path: Path
    identity: DirectoryIdentity
    inventory: tuple[str, ...]


@dataclass(frozen=True)
class CoverageAdmission:
    """The exact coverage tuple the signed grant made runtime-admissible."""

    authorization_id: str
    authorization_sha256: str
    measurement_receipt_sha256: str
    result_sha256: str
    run_id: str
    source_commit: str
    source_tree: str


@dataclass(frozen=True)
class PreparedRoots:
    """The signed root-preparation receipt reduced to its three roots."""

    receipt_sha256: str
    evidence: RootBinding
    pki: RootBinding
    runtime: RootBinding


@dataclass(frozen=True)
class AdmissionBinding:
    """The single admitted tuple produced by the post-commit artifact chain."""

    grant_version: str
    suite_commit: str
    suite_tree: str
    authorization_id: str
    authorization_sha256: str
    runtime_code_aggregate_sha256: str
    coverage: CoverageAdmission
    prepared_roots: PreparedRoots


@dataclass(frozen=True)
class AdmissionArtifacts:
    """The exact post-commit artifact bytes observed for one attempt."""

    coverage_authorization_bytes: bytes
    measurement_receipt_bytes: bytes
    coverage_pass_result_bytes: bytes
    root_preparation_receipt_bytes: bytes


@dataclass(frozen=True)
class ObservedRuntimeState:
    now: datetime
    suite_root: Path
    suite_head: str
    suite_tree: str
    suite_status: str
    admission_base_is_ancestor_of_head: bool
    admission_base_descends_d1_base: bool
    runtime_code_aggregate: str
    authorization_path: Path
    authorization_sha256: str
    expected_authorization_sha256: str
    exact_head_grant_path: Path
    exact_head_grant_sha256: str
    exact_head_grant_signature_path: Path
    exact_head_grant_allowed_signers_path: Path
    exact_head_grant_allowed_signers_sha256: str
    exact_head_grant_signature_verified: bool
    exact_head_grant: Mapping[str, str]
    b1_wheel_sha256: str
    candidate: CandidateState
    products: tuple[ObservedProduct, ...]
    host_temp_root: Path
    admission_artifacts: AdmissionArtifacts | None = None


@dataclass(frozen=True)
class RuntimeAuthorization:
    authorization_id: str
    authorized_at: datetime
    expires_at: datetime
    now: datetime
    suite_root: Path
    suite_head: str
    suite_admission_base: str
    aggregate_sha256: str
    authorization_sha256: str
    exact_head_grant_sha256: str
    runtime_root: Path
    evidence_root: Path
    product_roots: Mapping[str, Path]
    coverage: CoverageAdmission | None = None
    prepared_roots: PreparedRoots | None = None


@dataclass(frozen=True)
class MasterReservationFacts:
    """Master-bound facts sufficient to construct a non-consuming D2 stage."""

    aggregate_sha256: str
    b1_wheel: Path
    b1_wheel_sha256: str
    authorization_file: Path
    authorization_sha256: str
    authorization_signature: Path
    allowed_signers_file: Path
    external_roots: tuple[tuple[str, Path], ...]
    external_roots_sha256: str
    exact_head_grant_sha256: str
    master_evidence_root: Path
    marker_sha256: str
    postgres_evidence_root: Path
    postgres_runtime_root: Path
    repository_roots: tuple[tuple[str, Path], ...]
    repository_roots_sha256: str
    repository_tuple: tuple[tuple[str, str, str], ...]
    repository_tuple_sha256: str
    run_id: str


@dataclass(frozen=True)
class ReservedRuntimeBinding:
    """D2 resource binding derived from an already-consumed master authority."""

    authorization_id: str
    suite_root: Path
    suite_head: str
    suite_admission_base: str
    aggregate_sha256: str
    b1_wheel: Path
    b1_wheel_sha256: str
    authorization_sha256: str
    exact_head_grant_sha256: str
    external_roots_sha256: str
    repository_roots_sha256: str
    runtime_root: Path
    evidence_root: Path
    product_roots: Mapping[str, Path]
    repository_tuple: tuple[tuple[str, str, str], ...]
    prepared_roots: PreparedRoots | None = None
    master_reservation: MasterReservationFacts | None = None


RuntimeBinding = RuntimeAuthorization | ReservedRuntimeBinding


def master_reservation_payload(
    authorization: ReservedRuntimeBinding,
) -> dict[str, object]:
    """Serialize only the immutable facts retained from master admission."""

    facts = authorization.master_reservation
    if facts is None:
        _fail("master_reservation_frame_invalid")
    return {
        "aggregate_sha256": facts.aggregate_sha256,
        "b1_wheel": str(facts.b1_wheel),
        "b1_wheel_sha256": facts.b1_wheel_sha256,
        "authorization_file": str(facts.authorization_file),
        "authorization_sha256": facts.authorization_sha256,
        "authorization_signature": str(facts.authorization_signature),
        "allowed_signers_file": str(facts.allowed_signers_file),
        "external_roots": [
            {"capability": capability, "root": str(root)}
            for capability, root in facts.external_roots
        ],
        "external_roots_sha256": facts.external_roots_sha256,
        "exact_head_grant_sha256": facts.exact_head_grant_sha256,
        "master_evidence_root": str(facts.master_evidence_root),
        "marker_sha256": facts.marker_sha256,
        "postgres_evidence_root": str(facts.postgres_evidence_root),
        "postgres_runtime_root": str(facts.postgres_runtime_root),
        "repository_roots": [
            {"repository": repository, "root": str(root)}
            for repository, root in facts.repository_roots
        ],
        "repository_roots_sha256": facts.repository_roots_sha256,
        "repository_tuple": [
            {"commit": commit, "repository": repository, "tree": tree}
            for repository, commit, tree in facts.repository_tuple
        ],
        "repository_tuple_sha256": facts.repository_tuple_sha256,
        "run_id": facts.run_id,
        "schema": MASTER_RESERVATION_SCHEMA,
    }


def master_reservation_from_payload(payload: object) -> MasterReservationFacts:
    """Parse a MAC-authenticated master reservation without widening its schema."""

    expected = {
        "aggregate_sha256",
        "b1_wheel",
        "b1_wheel_sha256",
        "authorization_file",
        "authorization_sha256",
        "authorization_signature",
        "allowed_signers_file",
        "external_roots",
        "external_roots_sha256",
        "exact_head_grant_sha256",
        "master_evidence_root",
        "marker_sha256",
        "postgres_evidence_root",
        "postgres_runtime_root",
        "repository_roots",
        "repository_roots_sha256",
        "repository_tuple",
        "repository_tuple_sha256",
        "run_id",
        "schema",
    }
    if not isinstance(payload, Mapping) or set(payload) != expected:
        _fail("master_reservation_frame_invalid")
    external = payload["external_roots"]
    repository_roots = payload["repository_roots"]
    repository_tuple = payload["repository_tuple"]
    if (
        payload["schema"] != MASTER_RESERVATION_SCHEMA
        or not isinstance(external, list)
        or not isinstance(repository_roots, list)
        or not isinstance(repository_tuple, list)
    ):
        _fail("master_reservation_frame_invalid")

    def path(value: object) -> Path:
        if not isinstance(value, str) or not value:
            _fail("master_reservation_frame_invalid")
        candidate = Path(value)
        if not candidate.is_absolute() or str(candidate) != value:
            _fail("master_reservation_frame_invalid")
        return candidate

    try:
        external_values = tuple(
            (item["capability"], path(item["root"]))
            for item in external
            if isinstance(item, Mapping)
            and set(item) == {"capability", "root"}
            and isinstance(item["capability"], str)
        )
        repository_root_values = tuple(
            (item["repository"], path(item["root"]))
            for item in repository_roots
            if isinstance(item, Mapping)
            and set(item) == {"repository", "root"}
            and isinstance(item["repository"], str)
        )
        repository_tuple_values = tuple(
            (item["repository"], item["commit"], item["tree"])
            for item in repository_tuple
            if isinstance(item, Mapping)
            and set(item) == {"commit", "repository", "tree"}
            and all(isinstance(item[name], str) for name in item)
        )
    except (KeyError, TypeError, ValueError):
        _fail("master_reservation_frame_invalid")
    if (
        len(external_values) != len(external)
        or len(repository_root_values) != len(repository_roots)
        or len(repository_tuple_values) != len(repository_tuple)
    ):
        _fail("master_reservation_frame_invalid")
    scalar_names = (
        "aggregate_sha256",
        "b1_wheel_sha256",
        "authorization_sha256",
        "external_roots_sha256",
        "exact_head_grant_sha256",
        "marker_sha256",
        "repository_roots_sha256",
        "repository_tuple_sha256",
        "run_id",
    )
    if any(not isinstance(payload[name], str) for name in scalar_names):
        _fail("master_reservation_frame_invalid")
    return MasterReservationFacts(
        aggregate_sha256=payload["aggregate_sha256"],
        b1_wheel=path(payload["b1_wheel"]),
        b1_wheel_sha256=payload["b1_wheel_sha256"],
        authorization_file=path(payload["authorization_file"]),
        authorization_sha256=payload["authorization_sha256"],
        authorization_signature=path(payload["authorization_signature"]),
        allowed_signers_file=path(payload["allowed_signers_file"]),
        external_roots=external_values,
        external_roots_sha256=payload["external_roots_sha256"],
        exact_head_grant_sha256=payload["exact_head_grant_sha256"],
        master_evidence_root=path(payload["master_evidence_root"]),
        marker_sha256=payload["marker_sha256"],
        postgres_evidence_root=path(payload["postgres_evidence_root"]),
        postgres_runtime_root=path(payload["postgres_runtime_root"]),
        repository_roots=repository_root_values,
        repository_roots_sha256=payload["repository_roots_sha256"],
        repository_tuple=repository_tuple_values,
        repository_tuple_sha256=payload["repository_tuple_sha256"],
        run_id=payload["run_id"],
    )


def _fail(reason: str) -> Never:
    raise RuntimeAuthorizationFailure(reason)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
    except OSError:
        _fail("runtime_artifact_unavailable")
    return digest.hexdigest()


def _verify_runtime_source_tree(root: Path) -> None:
    source_root = root / _SOURCE_ROOT
    try:
        metadata = source_root.lstat()
    except OSError:
        _fail("runtime_source_tree_not_closed")
    if not stat.S_ISDIR(metadata.st_mode) or source_root.is_symlink():
        _fail("runtime_source_tree_not_closed")

    observed: dict[str, str] = {}

    def visit(directory: Path) -> None:
        try:
            with os.scandir(directory) as entries:
                for entry in entries:
                    path = Path(entry.path)
                    relative = path.relative_to(source_root).as_posix()
                    entry_metadata = entry.stat(follow_symlinks=False)
                    if stat.S_ISLNK(entry_metadata.st_mode):
                        _fail("runtime_source_tree_not_closed")
                    if stat.S_ISDIR(entry_metadata.st_mode):
                        observed[relative] = "directory"
                        visit(path)
                    elif stat.S_ISREG(entry_metadata.st_mode):
                        observed[relative] = "file"
                    else:
                        _fail("runtime_source_tree_not_closed")
        except OSError:
            _fail("runtime_source_tree_not_closed")

    visit(source_root)
    expected = {
        relative: ("directory" if relative == "cybrik_suite_uat_mtls" else "file")
        for relative in RUNTIME_SOURCE_TREE_PATHS
    }
    if observed != expected:
        _fail("runtime_source_tree_not_closed")


def runtime_code_aggregate(suite_root: Path) -> str:
    """Digest the sorted exact runtime surface using the versioned recipe."""

    root = Path(suite_root)
    payload = (
        f"{AGGREGATE_ALGORITHM}\n{len(RUNTIME_CODE_PATHS)}\n"
        f"{len(MUST_BE_ABSENT_RUNTIME_PATHS)}\n"
    )
    for relative in MUST_BE_ABSENT_RUNTIME_PATHS:
        path = root / relative
        try:
            path.lstat()
        except FileNotFoundError:
            payload += f"absent  {relative}\n"
            continue
        except OSError:
            _fail("runtime_denied_path_present")
        _fail("runtime_denied_path_present")
    _verify_runtime_source_tree(root)
    for relative in RUNTIME_CODE_PATHS:
        path = root / relative
        try:
            metadata = path.lstat()
        except OSError:
            _fail("runtime_code_path_invalid")
        if not stat.S_ISREG(metadata.st_mode) or path.is_symlink():
            _fail("runtime_code_path_invalid")
        payload += f"{_sha256(path)}  {relative}\n"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def parse_authorization(text: str) -> dict[str, str]:
    """Parse only the exact ordered LF-terminated authorization format."""

    if not isinstance(text, str) or "\r" in text or not text.endswith("\n"):
        _fail("authorization_document_invalid")
    lines = text.splitlines()
    if len(lines) != len(EXPECTED_FIELDS):
        _fail("authorization_document_invalid")
    fields: dict[str, str] = {}
    for expected, line in zip(EXPECTED_FIELDS, lines, strict=True):
        if not line.startswith(f"{expected}="):
            _fail("authorization_document_invalid")
        value = line[len(expected) + 1 :]
        if not value or value != value.strip():
            _fail("authorization_document_invalid")
        fields[expected] = value
    return fields


def parse_exact_head_grant(text: str) -> dict[str, str]:
    """Parse the external post-commit exact-head grant."""

    if not isinstance(text, str) or "\r" in text or not text.endswith("\n"):
        _fail("exact_head_grant_invalid")
    lines = text.splitlines()
    if len(lines) != len(EXACT_HEAD_GRANT_FIELDS):
        _fail("exact_head_grant_invalid")
    fields: dict[str, str] = {}
    for expected, line in zip(EXACT_HEAD_GRANT_FIELDS, lines, strict=True):
        if not line.startswith(f"{expected}="):
            _fail("exact_head_grant_invalid")
        value = line[len(expected) + 1 :]
        if not value or value != value.strip():
            _fail("exact_head_grant_invalid")
        fields[expected] = value
    return fields


# --------------------------------------------------------------------------
# Pure post-commit admission-artifact binding
#
# Everything below this banner and above the next one is a total function of
# its arguments: no filesystem, subprocess, environment or clock access.  The
# signature-verified exact-head grant is the only authority; the coverage and
# root-preparation artifacts are claims that must repeat it exactly.
# --------------------------------------------------------------------------

_COVERAGE_AUTHORIZATION_KEYS: Final = (
    "authorization_id",
    "measurement_command_sha256",
    "measurement_wrapper_sha256",
    "pinned_python_sha256",
    "receipt_policy_id",
    "suite_commit",
    "suite_tree",
)
_MEASUREMENT_RECEIPT_KEYS: Final = (
    "artifacts",
    "authorization",
    "execution_boundary",
    "producer",
    "receipt_id",
    "run",
    "schema_version",
    "source",
)
_MEASUREMENT_ARTIFACT_KEYS: Final = ("coverage_data_sha256", "coverage_json_sha256")
_MEASUREMENT_AUTHORIZATION_KEYS: Final = ("id", "sha256")
_EXECUTION_BOUNDARY_KEYS: Final = ("network_calls", "runtime_executed")
_PRODUCER_KEYS: Final = ("executable_sha256", "identity", "wrapper_sha256")
_RUN_KEYS: Final = ("command_sha256", "id", "nonce")
_SOURCE_KEYS: Final = ("suite_commit", "suite_tree")
_COVERAGE_RESULT_KEYS: Final = ("binding", "branch", "line", "status")
_COVERAGE_RESULT_BINDING_KEYS: Final = (
    "coverage_authorization_sha256",
    "measurement_receipt_sha256",
    "suite_commit",
    "suite_tree",
)
_COVERAGE_RATIO_KEYS: Final = ("covered", "ratio", "total")
_ROOT_PREPARATION_KEYS: Final = (
    "authorization_id",
    "authorization_sha256",
    "roots",
    "schema_version",
    "source",
)
_ROOT_KEYS: Final = ("identity", "inventory", "path")
_DIRECTORY_IDENTITY_KEYS: Final = ("mode", "st_dev", "st_ino", "uid")


def _refuse_admission() -> Never:
    """Refuse with the single stable admission reason."""

    _fail(ADMISSION_BINDING_MISMATCH)


def _admitted_digest(payload: object) -> str:
    if not isinstance(payload, bytes):
        _refuse_admission()
    return hashlib.sha256(payload).hexdigest()


def _admitted_canonical_object(payload: bytes) -> Mapping[str, object]:
    """Decode one canonical JSON object, refusing any other encoding of it."""

    try:
        record = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError):
        _refuse_admission()
    if not isinstance(record, dict) or _canonical_json(record) != payload:
        _refuse_admission()
    return record


def _admitted_mapping(value: object, keys: tuple[str, ...]) -> Mapping[str, object]:
    if not isinstance(value, Mapping) or set(value) != set(keys):
        _refuse_admission()
    return value


def _admitted_text(value: object, pattern: re.Pattern[str] | None = None) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        _refuse_admission()
    if pattern is not None and pattern.fullmatch(value) is None:
        _refuse_admission()
    return value


def _admitted_count(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        _refuse_admission()
    return value


def _admitted_source(value: object, *, suite_commit: str, suite_tree: str) -> None:
    source = _admitted_mapping(value, _SOURCE_KEYS)
    if source["suite_commit"] != suite_commit or source["suite_tree"] != suite_tree:
        _refuse_admission()


def _admitted_grant(exact_head_grant: object) -> Mapping[str, str]:
    """Accept only a complete, well-formed v2 grant field set.

    Field *order* is the document parser's contract; a parsed mapping is
    order-independent, so this pure layer pins the exact key set instead.
    """

    grant = _admitted_mapping(exact_head_grant, EXACT_HEAD_GRANT_FIELDS)
    for key, expected in EXACT_HEAD_GRANT_PINNED_VALUES.items():
        if grant[key] != expected:
            _refuse_admission()
    for key in EXACT_HEAD_GRANT_DIGEST_FIELDS:
        _admitted_text(grant[key], _HEX64)
    for key in ("SUITE_HEAD", "SUITE_TREE"):
        _admitted_text(grant[key], _HEX40)
    return {key: _admitted_text(grant[key]) for key in EXACT_HEAD_GRANT_FIELDS}


def _admitted_coverage_authorization(
    payload: bytes, *, suite_commit: str, suite_tree: str
) -> Mapping[str, object]:
    """Admit the coverage authorization from its exact canonical bytes only.

    The caller supplies bytes, never a decoded mapping and never a digest: the
    digest this record is bound by is derived here from the same bytes the
    signed grant pinned, so no caller-selected value can stand in for it.
    """

    record = _admitted_mapping(
        _admitted_canonical_object(payload), _COVERAGE_AUTHORIZATION_KEYS
    )
    if record["receipt_policy_id"] != COVERAGE_RECEIPT_POLICY_ID:
        _refuse_admission()
    _admitted_text(record["authorization_id"], _AUTHORIZATION_ID)
    for key in (
        "measurement_command_sha256",
        "measurement_wrapper_sha256",
        "pinned_python_sha256",
    ):
        _admitted_text(record[key], _HEX64)
    if record["suite_commit"] != suite_commit or record["suite_tree"] != suite_tree:
        _refuse_admission()
    return record


def _admitted_measurement_receipt(
    payload: bytes,
    *,
    coverage_authorization: Mapping[str, object],
    coverage_authorization_sha256: str,
    suite_commit: str,
    suite_tree: str,
) -> str:
    """Bind the receipt to its authorization, producer, run and source tuple."""

    receipt = _admitted_mapping(
        _admitted_canonical_object(payload), _MEASUREMENT_RECEIPT_KEYS
    )
    if receipt["schema_version"] != COVERAGE_MEASUREMENT_RECEIPT_SCHEMA:
        _refuse_admission()
    _admitted_text(receipt["receipt_id"])
    artifacts = _admitted_mapping(receipt["artifacts"], _MEASUREMENT_ARTIFACT_KEYS)
    for key in _MEASUREMENT_ARTIFACT_KEYS:
        _admitted_text(artifacts[key], _HEX64)
    claimed = _admitted_mapping(
        receipt["authorization"], _MEASUREMENT_AUTHORIZATION_KEYS
    )
    if (
        claimed["id"] != coverage_authorization["authorization_id"]
        or claimed["sha256"] != coverage_authorization_sha256
    ):
        _refuse_admission()
    boundary = _admitted_mapping(
        receipt["execution_boundary"], _EXECUTION_BOUNDARY_KEYS
    )
    if boundary["runtime_executed"] is not False or boundary["network_calls"] != []:
        _refuse_admission()
    producer = _admitted_mapping(receipt["producer"], _PRODUCER_KEYS)
    if (
        producer["identity"] != COVERAGE_PRODUCER_IDENTITY
        or producer["executable_sha256"]
        != coverage_authorization["pinned_python_sha256"]
        or producer["wrapper_sha256"]
        != coverage_authorization["measurement_wrapper_sha256"]
    ):
        _refuse_admission()
    run = _admitted_mapping(receipt["run"], _RUN_KEYS)
    if run["command_sha256"] != coverage_authorization["measurement_command_sha256"]:
        _refuse_admission()
    _admitted_text(run["nonce"], _HEX64)
    _admitted_source(
        receipt["source"], suite_commit=suite_commit, suite_tree=suite_tree
    )
    return _admitted_text(run["id"])


def _admitted_ratio(value: object) -> None:
    ratio = _admitted_mapping(value, _COVERAGE_RATIO_KEYS)
    covered = _admitted_count(ratio["covered"])
    total = _admitted_count(ratio["total"])
    measured = ratio["ratio"]
    if (
        covered > total
        or isinstance(measured, bool)
        or not isinstance(measured, int | float)
        or not 0.0 <= float(measured) <= 1.0
    ):
        _refuse_admission()


def _admitted_coverage_result(
    payload: bytes,
    *,
    coverage_authorization_sha256: str,
    measurement_receipt_sha256: str,
    suite_commit: str,
    suite_tree: str,
) -> None:
    """Admit only a PASS that repeats the exact receipt and source tuple."""

    result = _admitted_mapping(
        _admitted_canonical_object(payload), _COVERAGE_RESULT_KEYS
    )
    if result["status"] != COVERAGE_ADMISSIBLE_STATUS:
        _refuse_admission()
    binding = _admitted_mapping(result["binding"], _COVERAGE_RESULT_BINDING_KEYS)
    if (
        binding["coverage_authorization_sha256"] != coverage_authorization_sha256
        or binding["measurement_receipt_sha256"] != measurement_receipt_sha256
        or binding["suite_commit"] != suite_commit
        or binding["suite_tree"] != suite_tree
    ):
        _refuse_admission()
    for key in ("branch", "line"):
        _admitted_ratio(result[key])


def _admitted_directory_path(value: object) -> Path:
    text = _admitted_text(value)
    path = Path(text)
    if (
        not path.is_absolute()
        or text != os.path.normpath(text)
        or path == Path(path.anchor)
    ):
        _refuse_admission()
    return path


def _admitted_inventory(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        _refuse_admission()
    entries = tuple(_admitted_text(item) for item in value)
    if list(entries) != sorted(set(entries)):
        _refuse_admission()
    for entry in entries:
        relative = Path(entry)
        if (
            relative.is_absolute()
            or ".." in relative.parts
            or relative.as_posix() != entry
        ):
            _refuse_admission()
    return entries


def _admitted_root_binding(role: str, value: object) -> RootBinding:
    entry = _admitted_mapping(value, _ROOT_KEYS)
    declared = _admitted_mapping(entry["identity"], _DIRECTORY_IDENTITY_KEYS)
    mode = _admitted_text(declared["mode"], _DIRECTORY_MODE)
    inventory = _admitted_inventory(entry["inventory"])
    if mode != PREPARED_ROOT_MODE or inventory != PREPARED_ROOT_INITIAL_INVENTORY.get(
        role
    ):
        # A receipt that declares a used, understated or overstated root
        # describes something other than the one-shot initial state, so it is
        # never admissible.
        _refuse_admission()
    return RootBinding(
        role=role,
        path=_admitted_directory_path(entry["path"]),
        identity=DirectoryIdentity(
            mode=mode,
            st_dev=_admitted_count(declared["st_dev"]),
            st_ino=_admitted_count(declared["st_ino"]),
            uid=_admitted_count(declared["uid"]),
        ),
        inventory=inventory,
    )


def _assert_prepared_roots_are_distinct(roots: Mapping[str, RootBinding]) -> None:
    bindings = tuple(roots[role] for role in PREPARED_ROOT_ROLES)
    paths = tuple(binding.path for binding in bindings)
    identities = tuple(
        (binding.identity.st_dev, binding.identity.st_ino) for binding in bindings
    )
    if (
        len(set(paths)) != len(paths)
        or len(set(identities)) != len(identities)
        or len({binding.identity.uid for binding in bindings}) != 1
    ):
        _refuse_admission()
    evidence, pki, runtime = roots["evidence"], roots["pki"], roots["runtime"]
    if pki.path != runtime.path / PREPARED_PKI_LEAF or _overlap(
        evidence.path, runtime.path
    ):
        # Only the exact ``<runtime>/pki`` child can carry the signed PKI
        # identity: any other descendant is a different directory.
        _refuse_admission()


def _admitted_prepared_roots(
    payload: bytes,
    *,
    receipt_sha256: str,
    authorization_id: str,
    authorization_sha256: str,
    suite_commit: str,
    suite_tree: str,
) -> PreparedRoots:
    """Reduce the signed root-preparation receipt to three bound identities."""

    record = _admitted_mapping(
        _admitted_canonical_object(payload), _ROOT_PREPARATION_KEYS
    )
    if (
        record["schema_version"] != ROOT_PREPARATION_SCHEMA_VERSION
        or record["authorization_id"] != authorization_id
        or record["authorization_sha256"] != authorization_sha256
    ):
        _refuse_admission()
    _admitted_source(record["source"], suite_commit=suite_commit, suite_tree=suite_tree)
    declared = _admitted_mapping(record["roots"], PREPARED_ROOT_ROLES)
    roots = {
        role: _admitted_root_binding(role, declared[role])
        for role in PREPARED_ROOT_ROLES
    }
    _assert_prepared_roots_are_distinct(roots)
    return PreparedRoots(
        receipt_sha256=receipt_sha256,
        evidence=roots["evidence"],
        pki=roots["pki"],
        runtime=roots["runtime"],
    )


def validate_admission_artifacts(
    *,
    exact_head_grant: Mapping[str, str],
    runtime_authorization_id: str,
    runtime_authorization_sha256: str,
    observed_suite_commit: str,
    observed_suite_tree: str,
    coverage_authorization_bytes: bytes,
    measurement_receipt_bytes: bytes,
    coverage_pass_result_bytes: bytes,
    root_preparation_receipt_bytes: bytes,
) -> AdmissionBinding:
    """Admit one runtime tuple only when every signed digest binding holds.

    This runs *after* the exact-head grant signature has been verified.  The
    coverage authorization, its measurement receipt, the coverage PASS and the
    root-preparation receipt are caller-supplied bytes: none of them can widen
    admission, because every digest is derived here from those exact bytes,
    each must equal the digest the signed grant already pinned, and each record
    must repeat the same authorization, run and source tuple.  No caller-
    supplied digest is trusted.  Every refusal uses one stable, non-reflecting
    reason.
    """

    grant = _admitted_grant(exact_head_grant)
    if (
        _HEX40.fullmatch(observed_suite_commit) is None
        or _HEX40.fullmatch(observed_suite_tree) is None
        or _AUTHORIZATION_ID.fullmatch(runtime_authorization_id) is None
        or _HEX64.fullmatch(runtime_authorization_sha256) is None
    ):
        _refuse_admission()
    if (
        grant["SUITE_HEAD"] != observed_suite_commit
        or grant["SUITE_TREE"] != observed_suite_tree
        or grant["AUTHORIZATION_SHA256"] != runtime_authorization_sha256
    ):
        _refuse_admission()

    coverage_authorization_sha256 = _admitted_digest(coverage_authorization_bytes)
    receipt_sha256 = _admitted_digest(measurement_receipt_bytes)
    result_sha256 = _admitted_digest(coverage_pass_result_bytes)
    preparation_sha256 = _admitted_digest(root_preparation_receipt_bytes)
    if (
        coverage_authorization_sha256 != grant["COVERAGE_AUTHORIZATION_SHA256"]
        or receipt_sha256 != grant["COVERAGE_MEASUREMENT_RECEIPT_SHA256"]
        or result_sha256 != grant["COVERAGE_GATE_RESULT_SHA256"]
        or preparation_sha256 != grant["ROOT_PREPARATION_RECEIPT_SHA256"]
    ):
        _refuse_admission()

    authorization_record = _admitted_coverage_authorization(
        coverage_authorization_bytes,
        suite_commit=observed_suite_commit,
        suite_tree=observed_suite_tree,
    )
    run_id = _admitted_measurement_receipt(
        measurement_receipt_bytes,
        coverage_authorization=authorization_record,
        coverage_authorization_sha256=coverage_authorization_sha256,
        suite_commit=observed_suite_commit,
        suite_tree=observed_suite_tree,
    )
    _admitted_coverage_result(
        coverage_pass_result_bytes,
        coverage_authorization_sha256=coverage_authorization_sha256,
        measurement_receipt_sha256=receipt_sha256,
        suite_commit=observed_suite_commit,
        suite_tree=observed_suite_tree,
    )
    prepared_roots = _admitted_prepared_roots(
        root_preparation_receipt_bytes,
        receipt_sha256=preparation_sha256,
        authorization_id=runtime_authorization_id,
        authorization_sha256=runtime_authorization_sha256,
        suite_commit=observed_suite_commit,
        suite_tree=observed_suite_tree,
    )
    return AdmissionBinding(
        grant_version=EXACT_HEAD_GRANT_VERSION,
        suite_commit=observed_suite_commit,
        suite_tree=observed_suite_tree,
        authorization_id=runtime_authorization_id,
        authorization_sha256=runtime_authorization_sha256,
        runtime_code_aggregate_sha256=grant["RUNTIME_CODE_AGGREGATE_SHA256"],
        coverage=CoverageAdmission(
            authorization_id=str(authorization_record["authorization_id"]),
            authorization_sha256=coverage_authorization_sha256,
            measurement_receipt_sha256=receipt_sha256,
            result_sha256=result_sha256,
            run_id=run_id,
            source_commit=observed_suite_commit,
            source_tree=observed_suite_tree,
        ),
        prepared_roots=prepared_roots,
    )


# --------------------------------------------------------------------------
# Live observation and enforcement
# --------------------------------------------------------------------------


def _read_bound_regular_file(path: Path, *, maximum: int, reason: str) -> bytes:
    """Read one bounded regular-file inode without reopening its pathname."""

    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor: int | None = None
    try:
        descriptor = os.open(path, flags)
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_nlink != 1
            or before.st_size < 0
            or before.st_size > maximum
        ):
            _fail(reason)
        chunks: list[bytes] = []
        remaining = maximum + 1
        while remaining > 0:
            chunk = os.read(descriptor, min(64 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        payload = b"".join(chunks)
        after = os.fstat(descriptor)
        before_identity = (
            before.st_dev,
            before.st_ino,
            stat.S_IFMT(before.st_mode),
            before.st_size,
            before.st_mtime_ns,
            before.st_ctime_ns,
        )
        after_identity = (
            after.st_dev,
            after.st_ino,
            stat.S_IFMT(after.st_mode),
            after.st_size,
            after.st_mtime_ns,
            after.st_ctime_ns,
        )
        if (
            before_identity != after_identity
            or len(payload) != before.st_size
            or len(payload) > maximum
        ):
            _fail(reason)
        return payload
    except RuntimeAuthorizationFailure:
        raise
    except (OSError, TypeError, ValueError):
        _fail(reason)
    finally:
        if descriptor is not None:
            try:
                os.close(descriptor)
            except OSError:
                pass


def verify_master_consumption(facts: MasterReservationFacts) -> None:
    """Verify the exact master marker retained by the parent reservation."""

    reason = "master_consumption_marker_invalid"
    root_descriptor = -1
    marker_descriptor = -1
    try:
        root = facts.master_evidence_root
        if root.resolve(strict=True) != root:
            _fail(reason)
        root_descriptor = _open_directory_without_symlinks(root)
        root_identity = os.fstat(root_descriptor)
        marker_identity = os.stat(
            MASTER_CONSUMPTION_MARKER,
            dir_fd=root_descriptor,
            follow_symlinks=False,
        )
        if (
            not stat.S_ISDIR(root_identity.st_mode)
            or root_identity.st_uid != os.geteuid()
            or stat.S_IMODE(root_identity.st_mode) != 0o700
            or not stat.S_ISREG(marker_identity.st_mode)
            or marker_identity.st_uid != os.geteuid()
            or stat.S_IMODE(marker_identity.st_mode) != 0o600
            or marker_identity.st_nlink != 1
        ):
            _fail(reason)
        marker_descriptor = os.open(
            MASTER_CONSUMPTION_MARKER,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
            dir_fd=root_descriptor,
        )
        payload = _read_bounded_descriptor(
            marker_descriptor,
            marker_identity,
            maximum=MAX_CONSUMPTION_MARKER_BYTES,
            reason=reason,
        )
    except RuntimeAuthorizationFailure:
        raise
    except (OSError, TypeError, ValueError):
        _fail(reason)
    finally:
        if marker_descriptor >= 0:
            os.close(marker_descriptor)
        if root_descriptor >= 0:
            os.close(root_descriptor)
    expected = {
        "aggregate_sha256": facts.aggregate_sha256,
        "authorization_sha256": facts.authorization_sha256,
        "exact_head_grant_sha256": facts.exact_head_grant_sha256,
        "external_roots_sha256": facts.external_roots_sha256,
        "one_shot": True,
        "repository_roots_sha256": facts.repository_roots_sha256,
        "repository_tuple_sha256": facts.repository_tuple_sha256,
        "run_id": facts.run_id,
        "status": "consumed",
    }
    expected_payload = _canonical_json(expected) + b"\n"
    if payload != expected_payload or not hmac.compare_digest(
        hashlib.sha256(payload).hexdigest(), facts.marker_sha256
    ):
        _fail(reason)


def _open_master_public_artifact(
    path: Path, *, maximum: int, reason: str
) -> tuple[int, bytes]:
    descriptor = -1
    try:
        if not path.is_absolute() or path.resolve(strict=True) != path:
            _fail(reason)
        descriptor = os.open(
            path,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
        )
        identity = os.fstat(descriptor)
        if (
            not stat.S_ISREG(identity.st_mode)
            or stat.S_IMODE(identity.st_mode) != 0o600
            or identity.st_uid != os.geteuid()
            or identity.st_nlink != 1
        ):
            _fail(reason)
        payload = _read_bounded_descriptor(
            descriptor, identity, maximum=maximum, reason=reason
        )
        os.lseek(descriptor, 0, os.SEEK_SET)
        return descriptor, payload
    except RuntimeAuthorizationFailure:
        if descriptor >= 0:
            os.close(descriptor)
        raise
    except (OSError, TypeError, ValueError):
        if descriptor >= 0:
            os.close(descriptor)
        _fail(reason)


def _master_trust_descriptor(suite_root: Path) -> Mapping[str, str]:
    reason = "master_trust_descriptor_invalid"
    path = suite_root / MASTER_TRUST_DESCRIPTOR_REL
    payload = _read_bound_regular_file(path, maximum=16 * 1024, reason=reason)
    try:
        result = subprocess.run(
            (
                "/usr/bin/git",
                "-C",
                str(suite_root),
                "show",
                f"HEAD:{MASTER_TRUST_DESCRIPTOR_REL.as_posix()}",
            ),
            check=True,
            capture_output=True,
            timeout=10,
            env=dict(_GIT_ENV),
        )
        document = json.loads(payload)
    except (
        OSError,
        subprocess.SubprocessError,
        UnicodeDecodeError,
        json.JSONDecodeError,
    ):
        _fail(reason)
    expected = {
        "allowed_signers_sha256",
        "key_fingerprint",
        "key_type",
        "namespace",
        "python_sha256",
        "schema",
        "signer",
    }
    canonical = (
        json.dumps(document, sort_keys=True, separators=(",", ":")).encode() + b"\n"
    )
    if (
        result.stdout != payload
        or not isinstance(document, dict)
        or set(document) != expected
        or canonical != payload
        or document.get("schema") != "CYBRIK-UAT-SSH-AUTHORIZATION-TRUST/v1"
        or document.get("namespace") != MASTER_AUTHORIZATION_NAMESPACE
        or document.get("signer") != "FOUNDER"
        or document.get("key_type") != "ssh-ed25519"
        or _HEX64.fullmatch(str(document.get("allowed_signers_sha256", ""))) is None
        or _HEX64.fullmatch(str(document.get("python_sha256", ""))) is None
    ):
        _fail(reason)
    return MappingProxyType({str(key): str(value) for key, value in document.items()})


def _master_allowed_signer_identity(payload: bytes) -> tuple[str, str, str]:
    reason = "master_allowed_signers_invalid"
    try:
        line = payload.decode("ascii")
        signer, option, key_type, encoded = line.removesuffix("\n").split(" ")
        key_blob = base64.b64decode(encoded, validate=True)
    except (UnicodeDecodeError, ValueError):
        _fail(reason)
    if (
        not line.endswith("\n")
        or "\n" in line[:-1]
        or option != f'namespaces="{MASTER_AUTHORIZATION_NAMESPACE}"'
        or key_type != "ssh-ed25519"
    ):
        _fail(reason)
    fingerprint = "SHA256:" + base64.b64encode(
        hashlib.sha256(key_blob).digest()
    ).decode().rstrip("=")
    return signer, key_type, fingerprint


def _master_sshsig_verifier() -> Path:
    reason = "master_sshsig_verifier_invalid"
    verifier = EXACT_HEAD_GRANT_VERIFY_BINARY
    try:
        metadata = verifier.lstat()
        resolved = verifier.resolve(strict=True)
    except OSError:
        _fail(reason)
    if (
        resolved != verifier
        or verifier.is_symlink()
        or not stat.S_ISREG(metadata.st_mode)
        or metadata.st_uid != 0
        or stat.S_IMODE(metadata.st_mode) & 0o022
    ):
        _fail(reason)
    return verifier


def verify_signed_master_reservation(facts: MasterReservationFacts) -> None:
    """Anchor transported master facts to the tracked Founder SSHSIG trust root."""

    reason = "signed_master_reservation_invalid"
    suite_root = Path(__file__).resolve().parents[5]
    artifact_descriptors: list[int] = []
    try:
        authorization_descriptor, payload = _open_master_public_artifact(
            facts.authorization_file,
            maximum=MAX_AUTHORIZATION_BYTES,
            reason=reason,
        )
        artifact_descriptors.append(authorization_descriptor)
        signature_descriptor, signature = _open_master_public_artifact(
            facts.authorization_signature,
            maximum=MAX_AUTHORIZATION_BYTES,
            reason=reason,
        )
        artifact_descriptors.append(signature_descriptor)
        allowed_descriptor, allowed_payload = _open_master_public_artifact(
            facts.allowed_signers_file,
            maximum=MAX_ALLOWED_SIGNERS_BYTES,
            reason=reason,
        )
        artifact_descriptors.append(allowed_descriptor)
        b1_descriptor, b1_payload = _open_master_public_artifact(
            facts.b1_wheel,
            maximum=MAX_MASTER_B1_WHEEL_BYTES,
            reason=reason,
        )
        artifact_descriptors.append(b1_descriptor)
        descriptor = _master_trust_descriptor(suite_root)
        signer, key_type, fingerprint = _master_allowed_signer_identity(allowed_payload)
        if (
            hashlib.sha256(payload).hexdigest() != facts.authorization_sha256
            or hashlib.sha256(signature).hexdigest() != facts.exact_head_grant_sha256
            or hashlib.sha256(allowed_payload).hexdigest()
            != descriptor["allowed_signers_sha256"]
            or signer != descriptor["signer"]
            or key_type != descriptor["key_type"]
            or fingerprint != descriptor["key_fingerprint"]
            or hashlib.sha256(b1_payload).hexdigest() != facts.b1_wheel_sha256
        ):
            _fail(reason)
        verifier = _master_sshsig_verifier()
        verification = subprocess.run(
            (
                str(verifier),
                "-Y",
                "verify",
                "-f",
                f"/dev/fd/{allowed_descriptor}",
                "-I",
                signer,
                "-n",
                descriptor["namespace"],
                "-s",
                f"/dev/fd/{signature_descriptor}",
            ),
            input=payload,
            capture_output=True,
            check=False,
            pass_fds=(allowed_descriptor, signature_descriptor),
            timeout=10,
            env={"LC_ALL": "C", "PATH": "/usr/bin:/bin"},
        )
        document = json.loads(payload)
    except RuntimeAuthorizationFailure:
        raise
    except (
        OSError,
        subprocess.SubprocessError,
        UnicodeDecodeError,
        json.JSONDecodeError,
    ):
        _fail(reason)
    finally:
        for artifact_descriptor in artifact_descriptors:
            try:
                os.close(artifact_descriptor)
            except OSError:
                pass
    expected_fields = {
        "authorization_id",
        "authorized_by",
        "b1_wheel",
        "decision",
        "evidence_root",
        "expires_at",
        "external_roots",
        "external_roots_sha256",
        "helper_scripts",
        "issued_at",
        "one_shot",
        "python",
        "repository_roots",
        "repository_roots_sha256",
        "schema",
        "tracked_blob_aggregate",
        "tuple",
    }
    canonical = json.dumps(
        document, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    by_repository = {
        repository: {"commit": commit, "tree": tree}
        for repository, commit, tree in facts.repository_tuple
    }
    expected_tuple = {
        "suite": by_repository.get("cybrik-suite"),
        "soc": by_repository.get("cybrik-soc-command-center"),
        "cyber_ai": by_repository.get("cybrik-cyber-ai-platform"),
        "tool_fabric": by_repository.get("cybrik-security-tool-fabric"),
    }
    expected_external = [
        {"capability": capability, "root": str(root)}
        for capability, root in facts.external_roots
    ]
    expected_repositories = [
        {"repository": repository, "root": str(root)}
        for repository, root in facts.repository_roots
    ]
    aggregate = (
        document.get("tracked_blob_aggregate") if isinstance(document, dict) else None
    )
    try:
        issued_raw = document.get("issued_at")
        expires_raw = document.get("expires_at")
        if not isinstance(issued_raw, str) or not isinstance(expires_raw, str):
            _fail(reason)
        issued = datetime.fromisoformat(issued_raw)
        expires = datetime.fromisoformat(expires_raw)
        if issued.utcoffset() is None or expires.utcoffset() is None:
            _fail(reason)
        issued = issued.astimezone(UTC)
        expires = expires.astimezone(UTC)
        now = datetime.now(UTC)
    except (OverflowError, ValueError):
        _fail(reason)
    if (
        verification.returncode != 0
        or not isinstance(document, dict)
        or set(document) != expected_fields
        or canonical != payload
        or document.get("schema") != MASTER_AUTHORIZATION_SCHEMA
        or document.get("authorization_id") != facts.run_id
        or document.get("authorized_by") != "FOUNDER"
        or document.get("decision") != "APPROVE"
        or document.get("one_shot") is not True
        or issued > now
        or now >= expires
        or expires <= issued
        or expires - issued > timedelta(hours=24)
        or document.get("evidence_root") != str(facts.master_evidence_root)
        or document.get("b1_wheel")
        != {"path": str(facts.b1_wheel), "sha256": facts.b1_wheel_sha256}
        or document.get("external_roots") != expected_external
        or document.get("external_roots_sha256") != facts.external_roots_sha256
        or document.get("repository_roots") != expected_repositories
        or document.get("repository_roots_sha256") != facts.repository_roots_sha256
        or document.get("tuple") != expected_tuple
        or not isinstance(aggregate, dict)
        or aggregate.get("algorithm") != "cybrik-uat-tracked-blob-sha256-lines/v1"
        or aggregate.get("sha256") != facts.aggregate_sha256
        or not isinstance(aggregate.get("file_count"), int)
        or aggregate["file_count"] <= 0
    ):
        _fail(reason)


def read_authorization(path: Path) -> bytes:
    """Read the bounded authorization artifact from one stable inode."""

    return _read_bound_regular_file(
        path,
        maximum=MAX_AUTHORIZATION_BYTES,
        reason="authorization_artifact_invalid",
    )


def _timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        _fail("authorization_timestamp_invalid")
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        _fail("authorization_timestamp_invalid")
    return parsed.astimezone(UTC)


def _path(value: str, reason: str) -> Path:
    path = Path(value)
    if (
        not path.is_absolute()
        or value.startswith("//")
        or value != os.path.normpath(value)
        or value != str(path)
    ):
        _fail(reason)
    return path


def _overlap(left: Path, right: Path) -> bool:
    return left == right or left.is_relative_to(right) or right.is_relative_to(left)


def validate_authorization(
    fields: Mapping[str, str], observed: ObservedRuntimeState
) -> RuntimeAuthorization:
    """Validate every candidate, repository and external-root binding."""

    if tuple(fields) != EXPECTED_FIELDS:
        _fail("authorization_document_invalid")
    for key, expected in PINNED_VALUES.items():
        if fields.get(key) != expected:
            _fail("authorization_pinned_value_mismatch")
    if _AUTHORIZATION_ID.fullmatch(fields["AUTHORIZATION_ID"]) is None:
        _fail("authorization_id_invalid")
    for key, pattern in (
        ("SUITE_ADMISSION_BASE", _HEX40),
        ("RUNTIME_CODE_AGGREGATE_SHA256", _HEX64),
    ):
        if pattern.fullmatch(fields[key]) is None:
            _fail("authorization_digest_invalid")

    authorized_at = _timestamp(fields["AUTHORIZED_AT"])
    expires_at = _timestamp(fields["AUTHORIZATION_EXPIRES_AT"])
    if expires_at <= authorized_at or expires_at - authorized_at > _MAX_WINDOW:
        _fail("authorization_window_invalid")
    now = observed.now.astimezone(UTC)
    if not authorized_at <= now <= expires_at:
        _fail("authorization_not_current")

    suite_root = _path(fields["SUITE_ROOT"], "suite_root_invalid")
    if (
        suite_root != observed.suite_root
        or _HEX40.fullmatch(observed.suite_head) is None
        or _HEX40.fullmatch(observed.suite_tree) is None
    ):
        _fail("suite_state_mismatch")
    canonical_authorization = suite_root / AUTHORIZATION_REL
    if observed.authorization_path != canonical_authorization:
        _fail("authorization_path_not_canonical")
    if observed.authorization_sha256 != observed.expected_authorization_sha256:
        _fail("authorization_digest_mismatch")
    if observed.runtime_code_aggregate != fields["RUNTIME_CODE_AGGREGATE_SHA256"]:
        _fail("runtime_code_aggregate_mismatch")
    grant = observed.exact_head_grant
    if tuple(grant) != EXACT_HEAD_GRANT_FIELDS:
        _fail("exact_head_grant_invalid")
    for key, expected in EXACT_HEAD_GRANT_PINNED_VALUES.items():
        if grant.get(key) != expected:
            _fail("exact_head_grant_pinned_value_mismatch")
    if _HEX64.fullmatch(observed.exact_head_grant_sha256) is None:
        _fail("exact_head_grant_digest_invalid")
    if not observed.exact_head_grant_signature_verified:
        _fail("exact_head_grant_signature_invalid")
    if (
        _HEX64.fullmatch(fields["EXACT_HEAD_GRANT_ALLOWED_SIGNERS_SHA256"]) is None
        or observed.exact_head_grant_allowed_signers_sha256
        != fields["EXACT_HEAD_GRANT_ALLOWED_SIGNERS_SHA256"]
    ):
        _fail("exact_head_grant_signer_mismatch")
    if any(
        _HEX40.fullmatch(grant[key]) is None for key in ("SUITE_HEAD", "SUITE_TREE")
    ) or any(
        _HEX64.fullmatch(grant[key]) is None for key in EXACT_HEAD_GRANT_DIGEST_FIELDS
    ):
        _fail("exact_head_grant_invalid")
    if grant["AUTHORIZATION_SHA256"] != observed.authorization_sha256:
        _fail("exact_head_grant_authorization_mismatch")
    if (
        grant["SUITE_HEAD"] != observed.suite_head
        or grant["SUITE_TREE"] != observed.suite_tree
    ):
        _fail("suite_exact_head_mismatch")
    if grant["RUNTIME_CODE_AGGREGATE_SHA256"] != observed.runtime_code_aggregate:
        _fail("exact_head_grant_aggregate_mismatch")
    if observed.suite_status:
        _fail("suite_checkout_not_clean")
    if (
        not observed.admission_base_is_ancestor_of_head
        or not observed.admission_base_descends_d1_base
    ):
        _fail("suite_admission_base_invalid")
    if observed.b1_wheel_sha256 != fields["B1_WHEEL_SHA256"]:
        _fail("b1_wheel_digest_mismatch")

    candidate = observed.candidate
    if candidate.status != "not_run" or candidate.execution_authorized is not True:
        _fail("candidate_closed")
    if any(
        value != 0
        for value in (
            candidate.executed_checks,
            candidate.passed_checks,
            candidate.failed_checks,
        )
    ):
        _fail("candidate_attempt_counters_not_zero")
    if candidate.authorization_sha256 != observed.expected_authorization_sha256:
        _fail("candidate_does_not_pin_authorization")

    roots_by_role: dict[str, Path] = {}
    products = {product.role: product for product in observed.products}
    if set(products) != set(_PRODUCT_IDENTITIES) or len(products) != len(
        observed.products
    ):
        _fail("product_identity_mismatch")
    product_field_prefix = {
        "soc": "SOC",
        "cyber_ai": "CYBER_AI",
        "tool_fabric": "TOOL_FABRIC",
    }
    for role, identity in _PRODUCT_IDENTITIES.items():
        product = products[role]
        prefix = product_field_prefix[role]
        declared_root = _path(fields[f"{prefix}_ROOT"], "product_root_mismatch")
        if product.root != declared_root:
            _fail("product_root_mismatch")
        if (product.commit, product.tree) != identity:
            _fail("product_identity_mismatch")
        if not product.detached:
            _fail("product_head_not_detached")
        if product.status:
            _fail("product_checkout_not_clean")
        roots_by_role[role] = declared_root

    runtime_root = _path(fields["RUNTIME_ROOT"], "external_root_not_purpose_bound")
    evidence_root = _path(fields["EVIDENCE_ROOT"], "external_root_not_purpose_bound")
    for key, root in (("RUNTIME_ROOT", runtime_root), ("EVIDENCE_ROOT", evidence_root)):
        if root == Path(root.anchor) or _ROOT_NAMES[key].fullmatch(root.name) is None:
            _fail("external_root_not_purpose_bound")
        temp_roots = (Path("/tmp"), Path("/private/tmp"), observed.host_temp_root)
        if any(root == temp or root.is_relative_to(temp) for temp in temp_roots):
            _fail("external_root_under_temp")
    repository_roots = (suite_root, *roots_by_role.values())
    grant_artifacts = (
        (observed.exact_head_grant_path, _EXACT_HEAD_GRANT_NAME),
        (
            observed.exact_head_grant_signature_path,
            _EXACT_HEAD_GRANT_SIGNATURE_NAME,
        ),
        (
            observed.exact_head_grant_allowed_signers_path,
            _EXACT_HEAD_ALLOWED_SIGNERS_NAME,
        ),
    )
    for grant_artifact, name_pattern in grant_artifacts:
        try:
            metadata = grant_artifact.lstat()
            resolved = grant_artifact.resolve(strict=True)
        except OSError:
            _fail("exact_head_grant_path_invalid")
        if (
            grant_artifact != resolved
            or grant_artifact.is_symlink()
            or not stat.S_ISREG(metadata.st_mode)
            or metadata.st_nlink != 1
            or stat.S_IMODE(metadata.st_mode) & 0o022
            or name_pattern.fullmatch(grant_artifact.name) is None
            or any(
                _overlap(grant_artifact, repository) for repository in repository_roots
            )
        ):
            _fail("exact_head_grant_path_invalid")
    if _overlap(runtime_root, evidence_root) or any(
        _overlap(external, repository)
        for external in (runtime_root, evidence_root)
        for repository in repository_roots
    ):
        _fail("external_root_overlap")

    admitted = _admitted_post_commit_binding(
        fields, observed, runtime_root, evidence_root
    )
    return RuntimeAuthorization(
        authorization_id=fields["AUTHORIZATION_ID"],
        authorized_at=authorized_at,
        expires_at=expires_at,
        now=now,
        suite_root=suite_root,
        suite_head=observed.suite_head,
        suite_admission_base=fields["SUITE_ADMISSION_BASE"],
        aggregate_sha256=fields["RUNTIME_CODE_AGGREGATE_SHA256"],
        authorization_sha256=observed.authorization_sha256,
        exact_head_grant_sha256=observed.exact_head_grant_sha256,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        product_roots=MappingProxyType(roots_by_role),
        coverage=None if admitted is None else admitted.coverage,
        prepared_roots=None if admitted is None else admitted.prepared_roots,
    )


def _admitted_post_commit_binding(
    fields: Mapping[str, str],
    observed: ObservedRuntimeState,
    runtime_root: Path,
    evidence_root: Path,
) -> AdmissionBinding | None:
    """Bind the observed post-commit artifacts, when this attempt carries them.

    An attempt observed without artifacts carries no coverage or prepared-root
    binding at all; it can never present one, so no later step can mistake an
    absent binding for a verified one.
    """

    artifacts = observed.admission_artifacts
    if artifacts is None:
        return None
    admitted = validate_admission_artifacts(
        exact_head_grant=observed.exact_head_grant,
        runtime_authorization_id=fields["AUTHORIZATION_ID"],
        runtime_authorization_sha256=observed.authorization_sha256,
        observed_suite_commit=observed.suite_head,
        observed_suite_tree=observed.suite_tree,
        coverage_authorization_bytes=artifacts.coverage_authorization_bytes,
        measurement_receipt_bytes=artifacts.measurement_receipt_bytes,
        coverage_pass_result_bytes=artifacts.coverage_pass_result_bytes,
        root_preparation_receipt_bytes=artifacts.root_preparation_receipt_bytes,
    )
    if (
        admitted.prepared_roots.evidence.path != evidence_root
        or admitted.prepared_roots.runtime.path != runtime_root
        or admitted.runtime_code_aggregate_sha256
        != fields["RUNTIME_CODE_AGGREGATE_SHA256"]
    ):
        _refuse_admission()
    return admitted


def resolve_import_source_roots(
    authorization: RuntimeBinding,
) -> tuple[Path, ...]:
    """Admit only the exact import roots beneath the pinned repositories."""

    expected: list[Path] = []
    for role, relative in IMPORT_SOURCE_ROOTS:
        try:
            owner = (
                authorization.suite_root
                if role == "suite"
                else authorization.product_roots[role]
            )
        except KeyError:
            _fail("import_source_root_invalid")
        path = owner / relative
        try:
            resolved_owner = owner.resolve(strict=True)
            resolved = path.resolve(strict=True)
        except OSError:
            _fail("import_source_root_invalid")
        if not resolved.is_dir() or not resolved.is_relative_to(resolved_owner):
            _fail("import_source_root_invalid")
        # The lexical and resolved paths must match; this excludes symlinked
        # components even when they happen to resolve back under the owner.
        if resolved != path:
            _fail("import_source_root_invalid")
        expected.append(path)
    if isinstance(authorization, ReservedRuntimeBinding):
        if os.environ.get("PYTHONPATH", ""):
            _fail("import_path_not_pinned")
        return tuple(expected)
    actual = tuple(
        Path(item)
        for item in os.environ.get("PYTHONPATH", "").split(os.pathsep)
        if item
    )
    if actual != tuple(expected):
        _fail("import_path_not_pinned")
    return tuple(expected)


def _module_origin_root(
    authorization: RuntimeBinding, module_name: str
) -> tuple[str, Path]:
    namespace = next(
        (
            prefix
            for prefix in MODULE_ORIGIN_ROOTS
            if module_name == prefix or module_name.startswith(f"{prefix}.")
        ),
        None,
    )
    if namespace is None:
        _fail("import_source_root_invalid")
    role, relative = MODULE_ORIGIN_ROOTS[namespace]
    try:
        owner = (
            authorization.suite_root
            if role == "suite"
            else authorization.product_roots[role]
        )
    except KeyError:
        _fail("import_source_root_invalid")
    lexical_root = owner / relative
    try:
        resolved_owner = owner.resolve(strict=True)
        root = lexical_root.resolve(strict=True)
    except OSError:
        _fail("import_source_root_invalid")
    if root != lexical_root or not root.is_relative_to(resolved_owner):
        _fail("import_source_root_invalid")
    return namespace, root


def verify_module_origins(
    authorization: RuntimeBinding,
    module_origins: Sequence[tuple[str, Path]],
) -> None:
    """Bind each imported namespace to its single pinned package root."""

    for module_name, path in module_origins:
        _namespace, root = _module_origin_root(authorization, module_name)
        candidate = Path(path)
        try:
            resolved = candidate.resolve(strict=True)
        except OSError:
            _fail("import_source_root_invalid")
        if (
            candidate != resolved
            or not resolved.is_file()
            or not resolved.is_relative_to(root)
        ):
            _fail("import_source_root_invalid")


def verify_loaded_module_origins(
    authorization: RuntimeBinding,
    modules: Mapping[str, object] | None = None,
) -> None:
    """Verify every currently loaded module in each admitted Cybrik namespace."""

    inventory = sys.modules if modules is None else modules
    origins: list[tuple[str, Path]] = []
    for module_name, module in inventory.items():
        if not any(
            module_name == namespace or module_name.startswith(f"{namespace}.")
            for namespace in MODULE_ORIGIN_ROOTS
        ):
            continue
        module_file = getattr(module, "__file__", None)
        if isinstance(module_file, str) and module_file:
            origins.append((module_name, Path(module_file)))
            continue
        module_path = getattr(module, "__path__", None)
        if isinstance(module_path, (str, bytes)) or module_path is None:
            _fail("import_source_root_invalid")
        try:
            namespace_paths = tuple(module_path)
        except (OSError, TypeError, ValueError):
            _fail("import_source_root_invalid")
        namespace, root = _module_origin_root(authorization, module_name)
        parent_name, _separator, _leaf = module_name.rpartition(".")
        parent = inventory.get(parent_name)
        parent_file = getattr(parent, "__file__", None)
        if (
            module_name == namespace
            or not isinstance(parent_file, str)
            or not parent_file
        ):
            _fail("import_source_root_invalid")
        origins.append((parent_name, Path(parent_file)))
        suffix = module_name.removeprefix(namespace).removeprefix(".")
        expected = root.joinpath(*suffix.split(".")) if suffix else root
        if (
            len(namespace_paths) != 1
            or not isinstance(namespace_paths[0], str)
            or Path(namespace_paths[0]) != expected
        ):
            _fail("import_source_root_invalid")
        try:
            resolved = expected.resolve(strict=True)
        except OSError:
            _fail("import_source_root_invalid")
        if (
            resolved != expected
            or not resolved.is_dir()
            or not resolved.is_relative_to(root)
        ):
            _fail("import_source_root_invalid")
    verify_module_origins(authorization, origins)


def _marker_record_for_identity(
    authorization: RuntimeAuthorization, *, st_dev: int, st_ino: int
) -> dict[str, object]:
    return {
        "authorization_id": authorization.authorization_id,
        "authorization_sha256": authorization.authorization_sha256,
        "exact_head_grant_sha256": authorization.exact_head_grant_sha256,
        "consumed_at": authorization.now.isoformat(),
        "evidence_root": str(authorization.evidence_root),
        "evidence_root_identity": {
            "st_dev": st_dev,
            "st_ino": st_ino,
        },
        "one_shot": True,
        "runtime_code_aggregate_sha256": authorization.aggregate_sha256,
        "runtime_root": str(authorization.runtime_root),
        "status": "consumed",
        "suite_admission_base": authorization.suite_admission_base,
        "suite_head": authorization.suite_head,
    }


def _marker_record(
    authorization: RuntimeAuthorization, identity: os.stat_result
) -> dict[str, object]:
    return _marker_record_for_identity(
        authorization, st_dev=identity.st_dev, st_ino=identity.st_ino
    )


def _canonical_json(record: Mapping[str, object]) -> bytes:
    return json.dumps(dict(record), sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )


def _signed_prepared_roots(authorization: RuntimeAuthorization) -> PreparedRoots:
    """Return the three prepared roots this authorization is bound to.

    The identity comes from the root-preparation receipt that the verified
    exact-head grant already pinned by digest, so no step in the runtime can
    mint, replace or widen it the way a self-created adjacent ledger could.
    An attempt observed without that binding can never present one, so it is
    refused here rather than allowed to consume or verify anything.  All three
    prepared roles are re-checked together, so a receipt that understates the
    one-shot initial inventory, or that points the PKI role at anything other
    than the exact ``<runtime>/pki`` child, is refused before any consumption.
    """

    prepared = authorization.prepared_roots
    if prepared is None:
        _fail("authorization_consumption_mismatch")
    bound = {role: getattr(prepared, role) for role in PREPARED_ROOT_ROLES}
    if (
        prepared.evidence.path != authorization.evidence_root
        or prepared.runtime.path != authorization.runtime_root
        or prepared.pki.path != prepared.runtime.path / PREPARED_PKI_LEAF
        or _overlap(prepared.evidence.path, prepared.runtime.path)
        or any(
            binding.role != role
            or binding.inventory != PREPARED_ROOT_INITIAL_INVENTORY[role]
            for role, binding in bound.items()
        )
    ):
        _fail("authorization_consumption_mismatch")
    return prepared


def _signed_evidence_root(authorization: RuntimeAuthorization) -> RootBinding:
    """Return the signed evidence root the one-shot marker belongs in."""

    return _signed_prepared_roots(authorization).evidence


def signed_pki_root(authorization: RuntimeAuthorization) -> RootBinding:
    """Return the signed ``<runtime>/pki`` root seeding is bound to.

    Seeding never creates or infers this directory: it is prepared, signed and
    already verified, so the caller can only open the exact inode the receipt
    pinned.
    """

    return _signed_prepared_roots(authorization).pki


def _assert_signed_directory_identity(
    identity: os.stat_result, signed: DirectoryIdentity, *, reason: str
) -> None:
    if (
        not stat.S_ISDIR(identity.st_mode)
        or identity.st_dev != signed.st_dev
        or identity.st_ino != signed.st_ino
        or identity.st_uid != signed.uid
        or identity.st_uid != os.geteuid()
        or f"{stat.S_IMODE(identity.st_mode):04o}" != signed.mode
    ):
        _fail(reason)


def _open_directory_without_symlinks(path: Path) -> int:
    """Open an absolute directory by descriptor, rejecting every symlink hop."""

    flags = (
        os.O_RDONLY
        | getattr(os, "O_DIRECTORY", 0)
        | getattr(os, "O_NOFOLLOW", 0)
        | getattr(os, "O_CLOEXEC", 0)
    )
    descriptor = os.open(path.anchor, flags)
    try:
        for component in path.parts[1:]:
            child = os.open(component, flags, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


def _open_signed_root(
    signed: RootBinding, *, absent_reason: str, invalid_reason: str
) -> tuple[int, os.stat_result]:
    """Open one prepared root and bind it to its signed identity."""

    try:
        descriptor = _open_directory_without_symlinks(signed.path)
    except FileNotFoundError:
        _fail(absent_reason)
    except OSError:
        _fail(invalid_reason)
    try:
        identity = os.fstat(descriptor)
        _assert_signed_directory_identity(
            identity, signed.identity, reason=invalid_reason
        )
    except BaseException:
        os.close(descriptor)
        raise
    return descriptor, identity


def _assert_signed_initial_inventory(
    directory_descriptor: int,
    signed: RootBinding,
    *,
    consumed_reason: str,
    mismatch_reason: str,
) -> None:
    """Bind an opened prepared root to its exact signed initial inventory.

    The receipt only claims what the root held when it was prepared; this
    reads the live leaves of the already identity-bound inode and refuses any
    root that carries unsigned material.  A root that already holds the
    one-shot marker is no longer initial, so the caller can keep that state's
    precise reason instead of reporting it as inventory drift.
    """

    try:
        observed = tuple(sorted(os.listdir(directory_descriptor)))
    except OSError:
        _fail(mismatch_reason)
    if CONSUMPTION_MARKER in observed:
        _fail(consumed_reason)
    if observed != tuple(sorted(signed.inventory)):
        _fail(mismatch_reason)


def verify_prepared_runtime_roots(
    authorization: RuntimeAuthorization,
) -> PreparedRoots:
    """Verify the signed runtime and PKI roots before any leaf is created.

    Both roots were prepared and signed before this attempt started, so the
    runtime never creates, replaces or re-identifies either of them.  Each is
    opened without following a single symlink hop, bound to the exact signed
    device, inode, owner and mode, and required to still hold exactly its
    signed initial inventory: the runtime root holds only ``pki`` and the PKI
    root is empty.  Any drift refuses before the first authorized leaf.
    """

    prepared = _signed_prepared_roots(authorization)
    for signed in (prepared.runtime, prepared.pki):
        descriptor, _identity = _open_signed_root(
            signed,
            absent_reason=PREPARED_RUNTIME_ROOT_MISMATCH,
            invalid_reason=PREPARED_RUNTIME_ROOT_MISMATCH,
        )
        try:
            _assert_signed_initial_inventory(
                descriptor,
                signed,
                consumed_reason=PREPARED_RUNTIME_ROOT_MISMATCH,
                mismatch_reason=PREPARED_RUNTIME_ROOT_MISMATCH,
            )
        finally:
            os.close(descriptor)
    return prepared


def _remove_partial_marker(directory_descriptor: int, *, marker_created: bool) -> None:
    """Remove only this call's partial marker from the prepared root.

    The prepared evidence root is signed material this boundary never created,
    so a failed consumption never deletes it.
    """

    if not marker_created:
        return
    try:
        os.unlink(CONSUMPTION_MARKER, dir_fd=directory_descriptor)
        os.fsync(directory_descriptor)
    except OSError:
        return


def consume_once(authorization: RuntimeAuthorization) -> dict[str, object]:
    """Consume authorization once inside the signed, prepared evidence root."""

    signed = _signed_evidence_root(authorization)
    directory_descriptor, identity = _open_signed_root(
        signed,
        absent_reason="authorization_consumption_mismatch",
        invalid_reason="authorization_consumption_mismatch",
    )
    marker_descriptor = -1
    marker_created = False
    try:
        _assert_signed_initial_inventory(
            directory_descriptor,
            signed,
            consumed_reason="authorization_already_consumed",
            mismatch_reason="authorization_consumption_mismatch",
        )
        record = _marker_record(authorization, identity)
        payload = _canonical_json(record)
        try:
            marker_descriptor = os.open(
                CONSUMPTION_MARKER,
                os.O_WRONLY
                | os.O_CREAT
                | os.O_EXCL
                | getattr(os, "O_NOFOLLOW", 0)
                | getattr(os, "O_CLOEXEC", 0),
                0o600,
                dir_fd=directory_descriptor,
            )
        except FileExistsError:
            _fail("authorization_already_consumed")
        marker_created = True
        try:
            offset = 0
            while offset < len(payload):
                written = os.write(marker_descriptor, payload[offset:])
                if written <= 0:
                    raise OSError("marker write made no progress")
                offset += written
            os.fsync(marker_descriptor)
            os.fchmod(marker_descriptor, 0o600)
        finally:
            os.close(marker_descriptor)
            marker_descriptor = -1
        os.fsync(directory_descriptor)
        return record
    except RuntimeAuthorizationFailure:
        _remove_partial_marker(directory_descriptor, marker_created=marker_created)
        raise
    except OSError:
        _remove_partial_marker(directory_descriptor, marker_created=marker_created)
        _fail("authorization_consumption_failed")
    finally:
        if marker_descriptor >= 0:
            os.close(marker_descriptor)
        os.close(directory_descriptor)


def _read_bounded_descriptor(
    descriptor: int,
    locator_metadata: os.stat_result,
    *,
    maximum: int,
    reason: str,
) -> bytes:
    before = os.fstat(descriptor)
    before_identity = _file_identity(before)
    if (
        before_identity != _file_identity(locator_metadata)
        or not stat.S_ISREG(before.st_mode)
        or before.st_nlink != 1
        or before.st_size < 0
        or before.st_size > maximum
    ):
        _fail(reason)
    chunks: list[bytes] = []
    remaining = maximum + 1
    while remaining > 0:
        chunk = os.read(descriptor, min(64 * 1024, remaining))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    payload = b"".join(chunks)
    after = os.fstat(descriptor)
    if (
        _file_identity(after) != before_identity
        or len(payload) != before.st_size
        or len(payload) > maximum
    ):
        _fail(reason)
    return payload


def _read_marker(evidence_root: Path) -> tuple[dict[str, object], os.stat_result]:
    parent_descriptor = -1
    try:
        parent_descriptor = _open_directory_without_symlinks(evidence_root.parent)
        root_metadata = os.stat(
            evidence_root.name,
            dir_fd=parent_descriptor,
            follow_symlinks=False,
        )
        if not stat.S_ISDIR(root_metadata.st_mode):
            _fail("authorization_consumption_mismatch")
        directory_descriptor = os.open(
            evidence_root.name,
            os.O_RDONLY
            | getattr(os, "O_DIRECTORY", 0)
            | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_CLOEXEC", 0),
            dir_fd=parent_descriptor,
        )
    except OSError:
        _fail("authorization_not_consumed")
    finally:
        if parent_descriptor >= 0:
            os.close(parent_descriptor)
    try:
        root_identity = os.fstat(directory_descriptor)
        marker_lstat = os.stat(
            CONSUMPTION_MARKER, dir_fd=directory_descriptor, follow_symlinks=False
        )
        if not stat.S_ISREG(marker_lstat.st_mode):
            _fail("authorization_consumption_mismatch")
        marker_descriptor = os.open(
            CONSUMPTION_MARKER,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
            dir_fd=directory_descriptor,
        )
        try:
            payload = _read_bounded_descriptor(
                marker_descriptor,
                marker_lstat,
                maximum=MAX_CONSUMPTION_MARKER_BYTES,
                reason="authorization_consumption_mismatch",
            )
        finally:
            os.close(marker_descriptor)
    except OSError:
        _fail("authorization_not_consumed")
    finally:
        os.close(directory_descriptor)
    try:
        record = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError):
        _fail("authorization_consumption_mismatch")
    if not isinstance(record, dict):
        _fail("authorization_consumption_mismatch")
    return record, root_identity


def _consumed_at(record: Mapping[str, object]) -> datetime:
    value = record.get("consumed_at")
    if not isinstance(value, str):
        _fail("authorization_consumption_mismatch")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        _fail("authorization_consumption_mismatch")
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        _fail("authorization_consumption_mismatch")
    return parsed.astimezone(UTC)


def verify_consumption_marker(
    evidence_root: Path,
    *,
    expected_authorization_sha256: str | None = None,
    expected_exact_head_grant_sha256: str | None = None,
    expected_runtime_root: Path | None = None,
    expected_evidence_identity: Mapping[str, int] | None = None,
) -> dict[str, object] | None:
    """Read a marker for rollback without ever consuming authorization."""

    if not evidence_root.exists() and not evidence_root.is_symlink():
        return None
    record, identity = _read_marker(evidence_root)
    _consumed_at(record)
    expected_identity = {"st_dev": identity.st_dev, "st_ino": identity.st_ino}
    if (
        record.get("status") != "consumed"
        or record.get("one_shot") is not True
        or record.get("evidence_root") != str(evidence_root)
        or record.get("evidence_root_identity") != expected_identity
        or (
            expected_evidence_identity is not None
            and expected_identity != dict(expected_evidence_identity)
        )
        or (
            expected_authorization_sha256 is not None
            and record.get("authorization_sha256") != expected_authorization_sha256
        )
        or (
            expected_exact_head_grant_sha256 is not None
            and record.get("exact_head_grant_sha256")
            != expected_exact_head_grant_sha256
        )
        or (
            expected_runtime_root is not None
            and record.get("runtime_root") != str(expected_runtime_root)
        )
    ):
        _fail("authorization_consumption_mismatch")
    return record


def verify_consumed(authorization: RuntimeAuthorization) -> dict[str, object]:
    """Verify the exact first-start marker for every later mutating step."""

    signed = _signed_evidence_root(authorization)
    descriptor, _identity = _open_signed_root(
        signed,
        absent_reason="authorization_not_consumed",
        invalid_reason="authorization_consumption_mismatch",
    )
    os.close(descriptor)
    trusted_identity = {
        "st_dev": signed.identity.st_dev,
        "st_ino": signed.identity.st_ino,
    }
    record = verify_consumption_marker(
        authorization.evidence_root,
        expected_authorization_sha256=authorization.authorization_sha256,
        expected_exact_head_grant_sha256=authorization.exact_head_grant_sha256,
        expected_runtime_root=authorization.runtime_root,
        expected_evidence_identity=trusted_identity,
    )
    if record is None:
        _fail("authorization_not_consumed")
    expected = _marker_record_for_identity(
        authorization,
        st_dev=trusted_identity["st_dev"],
        st_ino=trusted_identity["st_ino"],
    )
    consumed_at = _consumed_at(record)
    if (
        not authorization.authorized_at <= consumed_at <= authorization.expires_at
        or consumed_at > authorization.now
        or set(record) != set(expected)
        or any(
            record.get(key) != value
            for key, value in expected.items()
            if key != "consumed_at"
        )
    ):
        _fail("authorization_consumption_mismatch")
    return record


def _git(root: Path, *args: str, allow_status: bool = False) -> str:
    try:
        completed = subprocess.run(
            ("git", "-C", str(root), *args),
            check=not allow_status,
            capture_output=True,
            text=True,
            timeout=30,
            shell=False,
            env=dict(_GIT_ENV),
        )
    except (OSError, subprocess.SubprocessError):
        _fail("repository_observation_failed")
    if allow_status and completed.returncode not in (0, 1):
        _fail("repository_observation_failed")
    return completed.stdout.strip()


def _is_git_ancestor(root: Path, ancestor: str, descendant: str) -> bool:
    """Return one bounded merge-base result without reflecting process details."""

    try:
        completed = subprocess.run(
            (
                "git",
                "-C",
                str(root),
                "merge-base",
                "--is-ancestor",
                ancestor,
                descendant,
            ),
            check=False,
            capture_output=True,
            timeout=30,
            shell=False,
            env=dict(_GIT_ENV),
        )
    except (OSError, subprocess.SubprocessError):
        _fail("repository_observation_failed")
    if completed.returncode not in (0, 1):
        _fail("repository_observation_failed")
    return completed.returncode == 0


def _candidate(path: Path) -> CandidateState:
    try:
        payload = _read_bound_regular_file(
            path,
            maximum=MAX_CANDIDATE_BYTES,
            reason="candidate_invalid",
        )
        document = json.loads(payload.decode("utf-8"))
        if not isinstance(document, Mapping):
            _fail("candidate_invalid")
        current = document["attempt_accounting"]["current_attempt"]
        if not isinstance(current, Mapping):
            _fail("candidate_invalid")
    except (
        AttributeError,
        OSError,
        KeyError,
        RecursionError,
        TypeError,
        ValueError,
    ):
        _fail("candidate_invalid")
    pinned = current.get("authorization_sha256")
    if pinned is None:
        evidence = document.get("evidence", {})
        if not isinstance(evidence, Mapping):
            _fail("candidate_invalid")
        artifacts = evidence.get("artifacts", [])
        if not isinstance(artifacts, list):
            _fail("candidate_invalid")
        for artifact in artifacts:
            if not isinstance(artifact, Mapping):
                _fail("candidate_invalid")
            if artifact.get("path") == AUTHORIZATION_REL.as_posix():
                pinned = artifact.get("sha256")
                break
    return CandidateState(
        status=current.get("status"),
        execution_authorized=current.get("execution_authorized"),
        executed_checks=current.get("executed_checks"),
        passed_checks=current.get("passed_checks"),
        failed_checks=current.get("failed_checks"),
        authorization_sha256=pinned,
    )


def _required_absolute_env(name: str, *, existing: bool) -> Path:
    raw = os.environ.get(name, "")
    path = Path(raw)
    if (
        not raw
        or not path.is_absolute()
        or os.path.normpath(raw) != raw
        or str(path) != raw
    ):
        _fail("runtime_environment_invalid")
    if existing:
        try:
            return path.resolve(strict=True)
        except OSError:
            _fail("runtime_environment_invalid")
    try:
        parent = path.parent.resolve(strict=True)
    except OSError:
        _fail("runtime_environment_invalid")
    return parent / path.name


def _admission_artifact_from_environment(environment_name: str) -> bytes:
    """Read one operator-supplied artifact without following its pathname.

    Environment values are locators only.  Authority remains in the signed
    exact-head grant: the returned bytes are subsequently hashed and compared
    with its v2 digest fields by ``validate_admission_artifacts``.
    """

    raw = os.environ.get(environment_name, "")
    try:
        path = _path(raw, "admission_artifact_invalid")
        metadata = path.lstat()
        resolved = path.resolve(strict=True)
    except RuntimeAuthorizationFailure:
        raise
    except (OSError, TypeError, ValueError):
        _fail("admission_artifact_invalid")
    if (
        resolved != path
        or path.is_symlink()
        or not stat.S_ISREG(metadata.st_mode)
        or metadata.st_nlink != 1
    ):
        _fail("admission_artifact_invalid")
    return _read_bound_regular_file(
        path,
        maximum=MAX_ADMISSION_ARTIFACT_BYTES,
        reason="admission_artifact_invalid",
    )


def _admission_artifacts_from_environment() -> AdmissionArtifacts:
    """Load the complete four-artifact admission tuple or refuse it all."""

    payloads = {
        field_name: _admission_artifact_from_environment(environment_name)
        for field_name, environment_name in ADMISSION_ARTIFACT_ENVIRONMENT.items()
    }
    return AdmissionArtifacts(**payloads)


def _external_grant_artifact(
    environment_name: str, name_pattern: re.Pattern[str]
) -> Path:
    path = _path(os.environ.get(environment_name, ""), "exact_head_grant_path_invalid")
    try:
        metadata = path.lstat()
        resolved = path.resolve(strict=True)
    except OSError:
        _fail("exact_head_grant_path_invalid")
    if (
        resolved != path
        or path.is_symlink()
        or not stat.S_ISREG(metadata.st_mode)
        or metadata.st_nlink != 1
        or stat.S_IMODE(metadata.st_mode) & 0o022
        or name_pattern.fullmatch(path.name) is None
    ):
        _fail("exact_head_grant_path_invalid")
    return path


def _verify_exact_head_signature(
    raw: bytes, signature: Path, allowed_signers_descriptor: int
) -> None:
    try:
        verifier = EXACT_HEAD_GRANT_VERIFY_BINARY
        metadata = verifier.lstat()
        resolved = verifier.resolve(strict=True)
    except OSError:
        _fail("exact_head_grant_verifier_invalid")
    if (
        resolved != verifier
        or verifier.is_symlink()
        or not stat.S_ISREG(metadata.st_mode)
        or metadata.st_uid != 0
        or stat.S_IMODE(metadata.st_mode) & 0o022
    ):
        _fail("exact_head_grant_verifier_invalid")
    verify_descriptor: int | None = None
    try:
        os.lseek(allowed_signers_descriptor, 0, os.SEEK_SET)
        verify_descriptor = os.dup(allowed_signers_descriptor)
        completed = subprocess.run(
            (
                str(verifier),
                "-Y",
                "verify",
                "-f",
                f"/dev/fd/{verify_descriptor}",
                "-I",
                EXACT_HEAD_GRANT_SIGNER_IDENTITY,
                "-n",
                EXACT_HEAD_GRANT_NAMESPACE,
                "-s",
                str(signature),
            ),
            input=raw,
            check=False,
            capture_output=True,
            timeout=30,
            shell=False,
            env={"PATH": "/usr/bin:/bin", "LC_ALL": "C"},
            pass_fds=(verify_descriptor,),
        )
    except (OSError, subprocess.SubprocessError):
        _fail("exact_head_grant_signature_invalid")
    finally:
        if verify_descriptor is not None:
            try:
                os.close(verify_descriptor)
            except OSError:
                pass
    if completed.returncode != 0:
        _fail("exact_head_grant_signature_invalid")


def _file_identity(
    metadata: os.stat_result,
) -> tuple[int, int, int, int, int, int, int]:
    return (
        metadata.st_dev,
        metadata.st_ino,
        stat.S_IFMT(metadata.st_mode),
        metadata.st_nlink,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_ctime_ns,
    )


def _open_bound_allowed_signers(path: Path) -> tuple[int, bytes, tuple[int, ...]]:
    """Open, validate and retain the exact signer inode used by OpenSSH."""

    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor: int | None = None
    keep_descriptor = False
    try:
        descriptor = os.open(path, flags)
        before = os.fstat(descriptor)
        locator = path.lstat()
        identity = _file_identity(before)
        if (
            identity != _file_identity(locator)
            or not stat.S_ISREG(before.st_mode)
            or before.st_nlink != 1
            or stat.S_IMODE(before.st_mode) & 0o022
            or before.st_size > MAX_ALLOWED_SIGNERS_BYTES
        ):
            _fail("exact_head_grant_signer_mismatch")
        chunks: list[bytes] = []
        remaining = MAX_ALLOWED_SIGNERS_BYTES + 1
        while remaining:
            chunk = os.read(descriptor, min(remaining, 4096))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        raw = b"".join(chunks)
        after = os.fstat(descriptor)
        if len(raw) > MAX_ALLOWED_SIGNERS_BYTES or _file_identity(after) != identity:
            _fail("exact_head_grant_signer_mismatch")
        os.lseek(descriptor, 0, os.SEEK_SET)
        keep_descriptor = True
        return descriptor, raw, identity
    except RuntimeAuthorizationFailure:
        raise
    except (OSError, TypeError, ValueError):
        _fail("exact_head_grant_signer_mismatch")
    finally:
        if descriptor is not None and not keep_descriptor:
            try:
                os.close(descriptor)
            except OSError:
                pass


def _assert_bound_allowed_signers(
    descriptor: int, path: Path, identity: tuple[int, ...]
) -> None:
    try:
        if (
            _file_identity(os.fstat(descriptor)) != identity
            or _file_identity(path.lstat()) != identity
        ):
            _fail("exact_head_grant_signer_mismatch")
    except RuntimeAuthorizationFailure:
        raise
    except (OSError, TypeError, ValueError):
        _fail("exact_head_grant_signer_mismatch")


def _exact_head_grant_from_environment(
    authorization_fields: Mapping[str, str],
) -> tuple[Path, dict[str, str], str, Path, Path, str, bool]:
    if not os.environ.get(
        "CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SIGNATURE"
    ) or not os.environ.get("CYBRIK_UAT_D2_EXACT_HEAD_ALLOWED_SIGNERS"):
        _fail("exact_head_grant_signature_invalid")
    path = _external_grant_artifact(
        "CYBRIK_UAT_D2_EXACT_HEAD_GRANT", _EXACT_HEAD_GRANT_NAME
    )
    signature = _external_grant_artifact(
        "CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SIGNATURE",
        _EXACT_HEAD_GRANT_SIGNATURE_NAME,
    )
    allowed_signers = _external_grant_artifact(
        "CYBRIK_UAT_D2_EXACT_HEAD_ALLOWED_SIGNERS",
        _EXACT_HEAD_ALLOWED_SIGNERS_NAME,
    )
    raw = read_authorization(path)
    allowed_signers_descriptor, allowed_signers_raw, allowed_signers_identity = (
        _open_bound_allowed_signers(allowed_signers)
    )
    try:
        try:
            allowed_signers_text = allowed_signers_raw.decode("ascii")
        except UnicodeDecodeError:
            _fail("exact_head_grant_signer_mismatch")
        signer_pattern = re.compile(
            rf"{re.escape(EXACT_HEAD_GRANT_SIGNER_IDENTITY)} "
            r"ssh-ed25519 [A-Za-z0-9+/]+={0,3}(?: [^\r\n]+)?\n"
        )
        if signer_pattern.fullmatch(allowed_signers_text) is None:
            _fail("exact_head_grant_signer_mismatch")
        allowed_signers_sha = hashlib.sha256(allowed_signers_raw).hexdigest()
        if (
            authorization_fields.get("EXACT_HEAD_GRANT_ALLOWED_SIGNERS_SHA256")
            != allowed_signers_sha
        ):
            _fail("exact_head_grant_signer_mismatch")
        _verify_exact_head_signature(raw, signature, allowed_signers_descriptor)
        _assert_bound_allowed_signers(
            allowed_signers_descriptor, allowed_signers, allowed_signers_identity
        )
    finally:
        try:
            os.close(allowed_signers_descriptor)
        except OSError:
            pass
    try:
        fields = parse_exact_head_grant(raw.decode("utf-8"))
    except UnicodeDecodeError:
        _fail("exact_head_grant_invalid")
    return (
        path,
        fields,
        hashlib.sha256(raw).hexdigest(),
        signature,
        allowed_signers,
        allowed_signers_sha,
        True,
    )


def verified_exact_head_grant_sha_for_rollback() -> str:
    """Re-authenticate the signed external grant before destructive rollback."""

    suite_root = Path(__file__).resolve().parents[5]
    authorization_path = _required_absolute_env(
        "CYBRIK_UAT_D2_AUTHORIZATION_PATH", existing=True
    )
    if authorization_path != suite_root / AUTHORIZATION_REL:
        _fail("authorization_path_not_canonical")
    raw = read_authorization(authorization_path)
    expected_sha = os.environ.get("CYBRIK_UAT_D2_AUTHORIZATION_SHA256", "")
    if (
        _HEX64.fullmatch(expected_sha) is None
        or hashlib.sha256(raw).hexdigest() != expected_sha
    ):
        _fail("authorization_digest_mismatch")
    try:
        fields = parse_authorization(raw.decode("utf-8"))
    except UnicodeDecodeError:
        _fail("authorization_document_invalid")
    return _exact_head_grant_from_environment(fields)[2]


def _admission_base_for_git(fields: Mapping[str, str]) -> str:
    admission_base = fields.get("SUITE_ADMISSION_BASE", "")
    if _HEX40.fullmatch(admission_base) is None:
        _fail("authorization_digest_invalid")
    return admission_base


def _observe_suite(root: Path, admission_base: str) -> tuple[str, str, str, bool]:
    """Resolve Suite HEAD once and reuse that immutable value everywhere.

    The Suite tree is derived from the already-resolved commit rather than from
    ``HEAD`` again, so the observed commit and tree can never straddle a
    concurrent reference move.
    """

    suite_head = _git(root, "rev-parse", "HEAD")
    suite_tree = _git(root, "rev-parse", f"{suite_head}^{{tree}}")
    suite_status = _git(
        root,
        "status",
        "--porcelain",
        "--untracked-files=all",
        "--ignored",
    )
    return (
        suite_head,
        suite_tree,
        suite_status,
        _is_git_ancestor(root, admission_base, suite_head),
    )


def authorize_from_environment() -> RuntimeAuthorization:
    """Observe the live exact tuple and authorize no action unless all pass."""

    if os.environ.get("CYBRIK_UAT_D2_EXECUTION_AUTHORIZED") != "true":
        _fail("candidate_closed")
    suite_root = Path(__file__).resolve().parents[5]
    authorization_path = _required_absolute_env(
        "CYBRIK_UAT_D2_AUTHORIZATION_PATH", existing=True
    )
    raw = read_authorization(authorization_path)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        _fail("authorization_document_invalid")
    fields = parse_authorization(text)
    expected_sha = os.environ.get("CYBRIK_UAT_D2_AUTHORIZATION_SHA256", "")
    if _HEX64.fullmatch(expected_sha) is None:
        _fail("authorization_digest_invalid")
    authorization_sha = hashlib.sha256(raw).hexdigest()
    (
        exact_head_grant_path,
        exact_head_grant,
        exact_head_grant_sha,
        exact_head_grant_signature_path,
        exact_head_grant_allowed_signers_path,
        exact_head_grant_allowed_signers_sha,
        exact_head_grant_signature_verified,
    ) = _exact_head_grant_from_environment(fields)
    wheel = _required_absolute_env("CYBRIK_UAT_D2_B1_WHEEL", existing=True)
    runtime_environment_root = _required_absolute_env(
        "CYBRIK_UAT_D2_RUNTIME_DIR", existing=False
    )
    evidence_environment_root = _required_absolute_env(
        "CYBRIK_UAT_D2_EVIDENCE_DIR", existing=False
    )
    if runtime_environment_root != Path(
        fields["RUNTIME_ROOT"]
    ) or evidence_environment_root != Path(fields["EVIDENCE_ROOT"]):
        _fail("runtime_environment_invalid")

    product_env = {
        "soc": "CYBRIK_UAT_D2_SOC_REPO",
        "cyber_ai": "CYBRIK_UAT_D2_AI_REPO",
        "tool_fabric": "CYBRIK_UAT_D2_FABRIC_REPO",
    }
    products: list[ObservedProduct] = []
    for role, env_name in product_env.items():
        root = _required_absolute_env(env_name, existing=True)
        products.append(
            ObservedProduct(
                role=role,
                root=root,
                commit=_git(root, "rev-parse", "HEAD"),
                tree=_git(root, "rev-parse", "HEAD^{tree}"),
                detached=bool(
                    _git(root, "symbolic-ref", "-q", "HEAD", allow_status=True) == ""
                ),
                status=_git(
                    root,
                    "status",
                    "--porcelain",
                    "--untracked-files=all",
                    "--ignored",
                ),
            )
        )
    admission_base = _admission_base_for_git(fields)
    suite_head, suite_tree, suite_status, admission_base_is_ancestor = _observe_suite(
        suite_root, admission_base
    )
    observed = ObservedRuntimeState(
        now=datetime.now(UTC),
        suite_root=suite_root,
        suite_head=suite_head,
        suite_tree=suite_tree,
        suite_status=suite_status,
        admission_base_is_ancestor_of_head=admission_base_is_ancestor,
        admission_base_descends_d1_base=_is_git_ancestor(
            suite_root, _D1_BASE, admission_base
        ),
        runtime_code_aggregate=runtime_code_aggregate(suite_root),
        authorization_path=authorization_path,
        authorization_sha256=authorization_sha,
        expected_authorization_sha256=expected_sha,
        exact_head_grant_path=exact_head_grant_path,
        exact_head_grant_sha256=exact_head_grant_sha,
        exact_head_grant_signature_path=exact_head_grant_signature_path,
        exact_head_grant_allowed_signers_path=exact_head_grant_allowed_signers_path,
        exact_head_grant_allowed_signers_sha256=(exact_head_grant_allowed_signers_sha),
        exact_head_grant_signature_verified=exact_head_grant_signature_verified,
        exact_head_grant=exact_head_grant,
        b1_wheel_sha256=_sha256(wheel),
        candidate=_candidate(suite_root / CANDIDATE_REL),
        products=tuple(products),
        host_temp_root=Path(tempfile.gettempdir()).resolve(),
        admission_artifacts=_admission_artifacts_from_environment(),
    )
    authorized = validate_authorization(fields, observed)
    resolve_import_source_roots(authorized)
    return authorized


def _master_repository_roots_digest(roots: Mapping[str, Path]) -> str:
    ordered = (
        ("cybrik-soc-command-center", roots["soc"]),
        ("cybrik-cyber-ai-platform", roots["cyber_ai"]),
        ("cybrik-security-tool-fabric", roots["tool_fabric"]),
        ("cybrik-suite", roots["suite"]),
    )
    payload = (
        json.dumps(
            [
                {"repository": repository, "root": str(root)}
                for repository, root in ordered
            ],
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        + "\n"
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _master_repository_tuple_digest(
    identities: tuple[tuple[str, str, str], ...],
) -> str:
    payload = (
        json.dumps(
            [
                {
                    "clean": True,
                    "commit": commit,
                    "repository": repository,
                    "tree": tree,
                }
                for repository, commit, tree in identities
            ],
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        + "\n"
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _master_external_roots_digest(roots: tuple[tuple[str, Path], ...]) -> str:
    payload = (
        json.dumps(
            [
                {"capability": capability, "root": str(root)}
                for capability, root in roots
            ],
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        + "\n"
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _master_root_binding(role: str, path: Path) -> RootBinding:
    try:
        metadata = path.lstat()
        resolved = path.resolve(strict=True)
    except OSError:
        _fail("master_stage_root_invalid")
    if (
        resolved != path
        or not stat.S_ISDIR(metadata.st_mode)
        or stat.S_IMODE(metadata.st_mode) != 0o700
        or metadata.st_uid != os.geteuid()
    ):
        _fail("master_stage_root_invalid")
    return RootBinding(
        role=role,
        path=path,
        identity=DirectoryIdentity(
            mode=PREPARED_ROOT_MODE,
            st_dev=metadata.st_dev,
            st_ino=metadata.st_ino,
            uid=metadata.st_uid,
        ),
        inventory=PREPARED_ROOT_INITIAL_INVENTORY[role],
    )


def _existing_master_prepared_roots(
    authorization_sha256: str, runtime_root: Path, evidence_root: Path
) -> PreparedRoots | None:
    pki_root = runtime_root / PREPARED_PKI_LEAF
    existence = tuple(
        path.exists() or path.is_symlink()
        for path in (evidence_root, pki_root, runtime_root)
    )
    evidence_exists, pki_exists, runtime_exists = existence
    if evidence_exists and runtime_exists and not pki_exists:
        return None
    if not all(existence):
        _fail("master_stage_root_invalid")
    bindings = {
        "evidence": _master_root_binding("evidence", evidence_root),
        "pki": _master_root_binding("pki", pki_root),
        "runtime": _master_root_binding("runtime", runtime_root),
    }
    receipt_payload = {
        "authorization_sha256": authorization_sha256,
        "roots": {
            role: {
                "path": str(binding.path),
                "st_dev": binding.identity.st_dev,
                "st_ino": binding.identity.st_ino,
                "uid": binding.identity.uid,
            }
            for role, binding in bindings.items()
        },
        "schema": "cybrik.integrated-uat.postgres-roots.v1",
    }
    receipt_sha256 = hashlib.sha256(_canonical_json(receipt_payload)).hexdigest()
    return PreparedRoots(receipt_sha256=receipt_sha256, **bindings)


def authorize_from_master_reservation(
    facts: MasterReservationFacts,
) -> ReservedRuntimeBinding:
    """Map one consumed master reservation into D2 authority without a child grant."""

    if not isinstance(facts, MasterReservationFacts):
        _fail("master_reservation_invalid")
    text_fields = (
        facts.aggregate_sha256,
        facts.b1_wheel_sha256,
        facts.authorization_sha256,
        facts.external_roots_sha256,
        facts.exact_head_grant_sha256,
        facts.marker_sha256,
        facts.repository_roots_sha256,
        facts.repository_tuple_sha256,
    )
    if any(_HEX64.fullmatch(value) is None for value in text_fields):
        _fail("master_reservation_invalid")
    if (
        not isinstance(facts.run_id, str)
        or _MASTER_RUN_ID.fullmatch(facts.run_id) is None
    ):
        _fail("master_reservation_invalid")
    expected_external_capabilities = (
        "postgres_d2_runtime",
        "postgres_d2_evidence",
        "alert_context_runtime",
        "alert_context_evidence",
        "alert_context_state",
    )
    if (
        tuple(capability for capability, _root in facts.external_roots)
        != expected_external_capabilities
        or _master_external_roots_digest(facts.external_roots)
        != facts.external_roots_sha256
    ):
        _fail("master_stage_root_mismatch")
    expected_repository_names = (
        "cybrik-soc-command-center",
        "cybrik-cyber-ai-platform",
        "cybrik-security-tool-fabric",
        "cybrik-suite",
    )
    if (
        tuple(name for name, _root in facts.repository_roots)
        != expected_repository_names
    ):
        _fail("master_repository_roots_mismatch")
    if (
        not isinstance(facts.repository_tuple, tuple)
        or len(facts.repository_tuple) != len(expected_repository_names)
        or any(
            not isinstance(identity, tuple) or len(identity) != 3
            for identity in facts.repository_tuple
        )
    ):
        _fail("master_reservation_invalid")
    for expected_name, identity in zip(
        expected_repository_names, facts.repository_tuple, strict=True
    ):
        repository, commit, tree = identity
        if (
            repository != expected_name
            or not isinstance(commit, str)
            or _HEX40.fullmatch(commit) is None
            or not isinstance(tree, str)
            or _HEX40.fullmatch(tree) is None
        ):
            _fail("master_reservation_invalid")
    if (
        _master_repository_tuple_digest(facts.repository_tuple)
        != facts.repository_tuple_sha256
    ):
        _fail("master_reservation_invalid")
    verify_signed_master_reservation(facts)
    roots_by_name = dict(facts.repository_roots)
    suite_root = Path(__file__).resolve().parents[5]
    if roots_by_name["cybrik-suite"] != suite_root:
        _fail("master_repository_roots_mismatch")
    roots = {
        "suite": suite_root,
        "soc": roots_by_name["cybrik-soc-command-center"],
        "cyber_ai": roots_by_name["cybrik-cyber-ai-platform"],
        "tool_fabric": roots_by_name["cybrik-security-tool-fabric"],
    }
    for root in roots.values():
        try:
            if root.resolve(strict=True) != root or not root.is_dir():
                _fail("master_repository_roots_mismatch")
        except OSError:
            _fail("master_repository_roots_mismatch")
    if _master_repository_roots_digest(roots) != facts.repository_roots_sha256:
        _fail("master_repository_roots_mismatch")
    runtime_root = facts.postgres_runtime_root
    evidence_root = facts.postgres_evidence_root
    try:
        runtime_parent = runtime_root.parent.resolve(strict=True)
        evidence_parent = evidence_root.parent.resolve(strict=True)
    except OSError:
        _fail("master_stage_root_mismatch")
    if (
        not runtime_root.is_absolute()
        or not evidence_root.is_absolute()
        or runtime_parent / runtime_root.name != runtime_root
        or evidence_parent / evidence_root.name != evidence_root
        or runtime_root == Path(runtime_root.anchor)
        or evidence_root == Path(evidence_root.anchor)
        or _ROOT_NAMES["RUNTIME_ROOT"].fullmatch(runtime_root.name) is None
        or _ROOT_NAMES["EVIDENCE_ROOT"].fullmatch(evidence_root.name) is None
    ):
        _fail("master_stage_root_mismatch")
    repository_roots = tuple(roots.values())
    if (
        _overlap(runtime_root, evidence_root)
        or _overlap(runtime_root, facts.master_evidence_root)
        or _overlap(evidence_root, facts.master_evidence_root)
        or any(
            _overlap(external, repository)
            for external in (runtime_root, evidence_root, facts.master_evidence_root)
            for repository in repository_roots
        )
    ):
        _fail("master_stage_root_overlap")
    tuple_by_name = {
        repository: (commit, tree)
        for repository, commit, tree in facts.repository_tuple
    }
    if set(tuple_by_name) != {
        "cybrik-soc-command-center",
        "cybrik-cyber-ai-platform",
        "cybrik-security-tool-fabric",
        "cybrik-suite",
    }:
        _fail("master_reservation_invalid")
    return ReservedRuntimeBinding(
        authorization_id=facts.run_id,
        suite_root=suite_root,
        suite_head=tuple_by_name["cybrik-suite"][0],
        suite_admission_base=tuple_by_name["cybrik-suite"][0],
        aggregate_sha256=facts.aggregate_sha256,
        b1_wheel=facts.b1_wheel,
        b1_wheel_sha256=facts.b1_wheel_sha256,
        authorization_sha256=facts.authorization_sha256,
        exact_head_grant_sha256=facts.exact_head_grant_sha256,
        external_roots_sha256=facts.external_roots_sha256,
        repository_roots_sha256=facts.repository_roots_sha256,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        product_roots=MappingProxyType(
            {
                "soc": roots["soc"],
                "cyber_ai": roots["cyber_ai"],
                "tool_fabric": roots["tool_fabric"],
            }
        ),
        repository_tuple=facts.repository_tuple,
        prepared_roots=_existing_master_prepared_roots(
            facts.authorization_sha256, runtime_root, evidence_root
        ),
        master_reservation=facts,
    )


def prepare_master_stage_roots(
    authorization: ReservedRuntimeBinding,
) -> ReservedRuntimeBinding:
    """Bind pre-created master roots and create only their nested PKI directory."""

    if not isinstance(authorization, ReservedRuntimeBinding):
        _fail("master_stage_authorization_invalid")
    if authorization.prepared_roots is not None:
        verify_prepared_runtime_roots(authorization)
        return authorization
    runtime_root = authorization.runtime_root
    evidence_root = authorization.evidence_root
    pki_root = runtime_root / PREPARED_PKI_LEAF
    try:
        evidence_binding = _master_root_binding("evidence", evidence_root)
        runtime_binding = _master_root_binding("runtime", runtime_root)
        if any(evidence_root.iterdir()) or any(runtime_root.iterdir()):
            _fail("master_stage_root_not_empty")
    except OSError:
        _fail("master_stage_root_invalid")
    try:
        os.mkdir(pki_root, 0o700)
        for path in (pki_root, runtime_root):
            descriptor = os.open(
                path,
                os.O_RDONLY
                | getattr(os, "O_DIRECTORY", 0)
                | getattr(os, "O_NOFOLLOW", 0),
            )
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
    except OSError:
        try:
            pki_root.rmdir()
        except OSError:
            pass
        _fail("master_stage_root_preparation_failed")
    pki_binding = _master_root_binding("pki", pki_root)
    receipt_payload = {
        "authorization_sha256": authorization.authorization_sha256,
        "external_roots_sha256": authorization.external_roots_sha256,
        "roots": {
            role: str(binding.path)
            for role, binding in (
                ("evidence", evidence_binding),
                ("pki", pki_binding),
                ("runtime", runtime_binding),
            )
        },
        "schema": "cybrik.integrated-uat.postgres-roots.v1",
    }
    prepared = PreparedRoots(
        receipt_sha256=hashlib.sha256(_canonical_json(receipt_payload)).hexdigest(),
        evidence=evidence_binding,
        pki=pki_binding,
        runtime=runtime_binding,
    )
    return replace(authorization, prepared_roots=prepared)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate the D2 runtime authorization"
    )
    parser.add_argument("--check-only", action="store_true", required=True)
    parser.parse_args(argv)
    try:
        authorize_from_environment()
    except RuntimeAuthorizationFailure as exc:
        print(
            f"D2 runtime authorization refused: {exc.reason}",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
