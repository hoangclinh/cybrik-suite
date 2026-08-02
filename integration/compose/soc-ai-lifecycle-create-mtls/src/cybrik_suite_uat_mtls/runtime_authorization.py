"""Fail-closed authorization boundary for the single D2 runtime attempt.

The authorization document binds an admitted Suite ancestor and a digest of
the exact runtime surface.  It deliberately does not bind the commit that
contains the authorization document: doing so would create an impossible Git
self-reference.  Importing this module is inert and every helper is suitable
for synthetic, no-network unit tests.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import MappingProxyType
from typing import Final, Never

from . import policy

BINDING_VERSION: Final = "CYBRIK-D2-RUNTIME-AUTH/v1"
AGGREGATE_ALGORITHM: Final = "cybrik-runtime-code-sha256-lines/v1"
CONSUMPTION_MARKER: Final = ".cybrik-d2-runtime-consumed.json"
ROLLBACK_POLICY: Final = "verify-marker-if-present-then-teardown-and-verify-absent"

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
RUNTIME_CODE_PATHS: Final = tuple(
    sorted(
        (
            f"{_PACKAGE}/__init__.py",
            f"{_PACKAGE}/client.py",
            f"{_PACKAGE}/evidence.py",
            f"{_PACKAGE}/harness.py",
            f"{_PACKAGE}/pki.py",
            f"{_PACKAGE}/policy.py",
            f"{_PACKAGE}/procedure.py",
            f"{_PACKAGE}/runtime_authorization.py",
            f"{_PACKAGE}/server.py",
            f"{_PACKAGE}/store.py",
            "integration/compose/soc-ai-lifecycle-create-mtls/pyproject.toml",
            (
                "integration/compose/soc-ai-lifecycle-create-mtls/tests/"
                "test_lifecycle_runtime.py"
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
_AUTHORIZATION_ID = re.compile(r"[a-z0-9][a-z0-9._-]{0,127}")
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
class ObservedRuntimeState:
    now: datetime
    suite_root: Path
    suite_head: str
    suite_status: str
    admission_base_is_ancestor_of_head: bool
    admission_base_descends_d1_base: bool
    runtime_code_aggregate: str
    authorization_path: Path
    authorization_sha256: str
    expected_authorization_sha256: str
    b1_wheel_sha256: str
    candidate: CandidateState
    products: tuple[ObservedProduct, ...]
    host_temp_root: Path


@dataclass(frozen=True)
class RuntimeAuthorization:
    authorization_id: str
    authorized_at: datetime
    expires_at: datetime
    now: datetime
    suite_root: Path
    suite_admission_base: str
    aggregate_sha256: str
    authorization_sha256: str
    runtime_root: Path
    evidence_root: Path
    product_roots: Mapping[str, Path]


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


def read_authorization(path: Path) -> bytes:
    """Read a regular authorization file without following its final symlink."""

    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            os.close(descriptor)
            _fail("authorization_artifact_invalid")
        with os.fdopen(descriptor, "rb") as stream:
            return stream.read()
    except OSError:
        _fail("authorization_artifact_invalid")


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
    ):
        _fail("suite_state_mismatch")
    canonical_authorization = suite_root / AUTHORIZATION_REL
    if observed.authorization_path != canonical_authorization:
        _fail("authorization_path_not_canonical")
    if observed.authorization_sha256 != observed.expected_authorization_sha256:
        _fail("authorization_digest_mismatch")
    if observed.suite_status:
        _fail("suite_checkout_not_clean")
    if (
        not observed.admission_base_is_ancestor_of_head
        or not observed.admission_base_descends_d1_base
    ):
        _fail("suite_admission_base_invalid")
    if observed.runtime_code_aggregate != fields["RUNTIME_CODE_AGGREGATE_SHA256"]:
        _fail("runtime_code_aggregate_mismatch")
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
    if _overlap(runtime_root, evidence_root) or any(
        _overlap(external, repository)
        for external in (runtime_root, evidence_root)
        for repository in repository_roots
    ):
        _fail("external_root_overlap")

    return RuntimeAuthorization(
        authorization_id=fields["AUTHORIZATION_ID"],
        authorized_at=authorized_at,
        expires_at=expires_at,
        now=now,
        suite_root=suite_root,
        suite_admission_base=fields["SUITE_ADMISSION_BASE"],
        aggregate_sha256=fields["RUNTIME_CODE_AGGREGATE_SHA256"],
        authorization_sha256=observed.authorization_sha256,
        runtime_root=runtime_root,
        evidence_root=evidence_root,
        product_roots=MappingProxyType(roots_by_role),
    )


def resolve_import_source_roots(
    authorization: RuntimeAuthorization,
) -> tuple[Path, ...]:
    """Admit only the exact import roots beneath the pinned repositories."""

    expected: list[Path] = []
    for role, relative in IMPORT_SOURCE_ROOTS:
        owner = (
            authorization.suite_root
            if role == "suite"
            else authorization.product_roots[role]
        )
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
    actual = tuple(
        Path(item)
        for item in os.environ.get("PYTHONPATH", "").split(os.pathsep)
        if item
    )
    if actual != tuple(expected):
        _fail("import_path_not_pinned")
    return tuple(expected)


def verify_module_origins(
    authorization: RuntimeAuthorization,
    module_origins: Sequence[tuple[str, Path]],
) -> None:
    """Bind each imported namespace to its single pinned package root."""

    for module_name, path in module_origins:
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
        owner = (
            authorization.suite_root
            if role == "suite"
            else authorization.product_roots[role]
        )
        lexical_root = owner / relative
        try:
            resolved_owner = owner.resolve(strict=True)
            root = lexical_root.resolve(strict=True)
        except OSError:
            _fail("import_source_root_invalid")
        if root != lexical_root or not root.is_relative_to(resolved_owner):
            _fail("import_source_root_invalid")
        try:
            resolved = Path(path).resolve(strict=True)
        except OSError:
            _fail("import_source_root_invalid")
        if not resolved.is_relative_to(root):
            _fail("import_source_root_invalid")


def _marker_record(
    authorization: RuntimeAuthorization, identity: os.stat_result
) -> dict[str, object]:
    return {
        "authorization_id": authorization.authorization_id,
        "authorization_sha256": authorization.authorization_sha256,
        "consumed_at": authorization.now.isoformat(),
        "evidence_root": str(authorization.evidence_root),
        "evidence_root_identity": {
            "st_dev": identity.st_dev,
            "st_ino": identity.st_ino,
        },
        "one_shot": True,
        "runtime_code_aggregate_sha256": authorization.aggregate_sha256,
        "runtime_root": str(authorization.runtime_root),
        "status": "consumed",
        "suite_admission_base": authorization.suite_admission_base,
    }


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


def _cleanup_failed_consumption(
    *,
    parent_descriptor: int,
    directory_descriptor: int,
    root_name: str,
    created_identity: os.stat_result | None,
    marker_created: bool,
) -> None:
    """Remove only this call's partial marker and still-empty fresh directory."""

    if directory_descriptor >= 0 and marker_created:
        try:
            os.unlink(CONSUMPTION_MARKER, dir_fd=directory_descriptor)
            os.fsync(directory_descriptor)
        except OSError:
            return
    if parent_descriptor < 0 or created_identity is None:
        return
    try:
        current = os.stat(root_name, dir_fd=parent_descriptor, follow_symlinks=False)
        if (
            not stat.S_ISDIR(current.st_mode)
            or current.st_dev != created_identity.st_dev
            or current.st_ino != created_identity.st_ino
        ):
            return
        os.rmdir(root_name, dir_fd=parent_descriptor)
        os.fsync(parent_descriptor)
    except OSError:
        # A concurrent addition or rename makes deletion unsafe.  Leave the
        # burned root in place rather than deleting material we did not create.
        return


def consume_once(authorization: RuntimeAuthorization) -> dict[str, object]:
    """Atomically consume authorization by creating a fresh root and marker."""

    root = authorization.evidence_root
    parent_descriptor = -1
    directory_descriptor = -1
    marker_descriptor = -1
    created_identity: os.stat_result | None = None
    marker_created = False
    try:
        parent_descriptor = _open_directory_without_symlinks(root.parent)
        os.mkdir(root.name, 0o700, dir_fd=parent_descriptor)
        created_identity = os.stat(
            root.name, dir_fd=parent_descriptor, follow_symlinks=False
        )
        directory_descriptor = os.open(
            root.name,
            os.O_RDONLY
            | getattr(os, "O_DIRECTORY", 0)
            | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_CLOEXEC", 0),
            dir_fd=parent_descriptor,
        )
        identity = os.fstat(directory_descriptor)
        if (
            not stat.S_ISDIR(identity.st_mode)
            or identity.st_dev != created_identity.st_dev
            or identity.st_ino != created_identity.st_ino
        ):
            _fail("authorization_already_consumed")
        os.fchmod(directory_descriptor, 0o700)
        record = _marker_record(authorization, identity)
        payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
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
        _cleanup_failed_consumption(
            parent_descriptor=parent_descriptor,
            directory_descriptor=directory_descriptor,
            root_name=root.name,
            created_identity=created_identity,
            marker_created=marker_created,
        )
        raise
    except OSError:
        _cleanup_failed_consumption(
            parent_descriptor=parent_descriptor,
            directory_descriptor=directory_descriptor,
            root_name=root.name,
            created_identity=created_identity,
            marker_created=marker_created,
        )
        if created_identity is None:
            _fail("authorization_already_consumed")
        _fail("authorization_consumption_failed")
    finally:
        if marker_descriptor >= 0:
            os.close(marker_descriptor)
        if directory_descriptor >= 0:
            os.close(directory_descriptor)
        if parent_descriptor >= 0:
            os.close(parent_descriptor)


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
            marker_metadata = os.fstat(marker_descriptor)
            if not stat.S_ISREG(marker_metadata.st_mode):
                _fail("authorization_consumption_mismatch")
            with os.fdopen(marker_descriptor, "rb", closefd=False) as stream:
                payload = stream.read()
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
    expected_runtime_root: Path | None = None,
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
            expected_authorization_sha256 is not None
            and record.get("authorization_sha256") != expected_authorization_sha256
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

    record = verify_consumption_marker(
        authorization.evidence_root,
        expected_authorization_sha256=authorization.authorization_sha256,
        expected_runtime_root=authorization.runtime_root,
    )
    if record is None:
        _fail("authorization_not_consumed")
    expected = _marker_record(
        authorization,
        os.stat(authorization.evidence_root, follow_symlinks=False),
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
        )
    except (OSError, subprocess.SubprocessError):
        _fail("repository_observation_failed")
    if allow_status and completed.returncode not in (0, 1):
        _fail("repository_observation_failed")
    return completed.stdout.strip()


def _candidate(path: Path) -> CandidateState:
    try:
        if path.is_symlink() or not path.is_file():
            _fail("candidate_invalid")
        document = json.loads(path.read_text(encoding="utf-8"))
        current = document["attempt_accounting"]["current_attempt"]
    except (OSError, KeyError, TypeError, json.JSONDecodeError):
        _fail("candidate_invalid")
    pinned = current.get("authorization_sha256")
    if pinned is None:
        artifacts = document.get("evidence", {}).get("artifacts", [])
        for artifact in artifacts:
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
    if not raw or not path.is_absolute():
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


def _admission_base_for_git(fields: Mapping[str, str]) -> str:
    admission_base = fields.get("SUITE_ADMISSION_BASE", "")
    if _HEX40.fullmatch(admission_base) is None:
        _fail("authorization_digest_invalid")
    return admission_base


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
    observed = ObservedRuntimeState(
        now=datetime.now(UTC),
        suite_root=suite_root,
        suite_head=_git(suite_root, "rev-parse", "HEAD"),
        suite_status=_git(
            suite_root,
            "status",
            "--porcelain",
            "--untracked-files=all",
            "--ignored",
        ),
        admission_base_is_ancestor_of_head=(
            subprocess.run(
                (
                    "git",
                    "-C",
                    str(suite_root),
                    "merge-base",
                    "--is-ancestor",
                    admission_base,
                    "HEAD",
                ),
                check=False,
                capture_output=True,
                timeout=30,
            ).returncode
            == 0
        ),
        admission_base_descends_d1_base=(
            subprocess.run(
                (
                    "git",
                    "-C",
                    str(suite_root),
                    "merge-base",
                    "--is-ancestor",
                    _D1_BASE,
                    admission_base,
                ),
                check=False,
                capture_output=True,
                timeout=30,
            ).returncode
            == 0
        ),
        runtime_code_aggregate=runtime_code_aggregate(suite_root),
        authorization_path=authorization_path,
        authorization_sha256=authorization_sha,
        expected_authorization_sha256=expected_sha,
        b1_wheel_sha256=_sha256(wheel),
        candidate=_candidate(suite_root / CANDIDATE_REL),
        products=tuple(products),
        host_temp_root=Path(tempfile.gettempdir()).resolve(),
    )
    authorized = validate_authorization(fields, observed)
    resolve_import_source_roots(authorized)
    return authorized


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
