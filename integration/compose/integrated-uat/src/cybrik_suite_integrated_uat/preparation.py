"""Unsigned, fail-closed preparation for the integrated UAT master packet."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import subprocess
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Final

from . import admission
from .models import (
    EXPECTED_EXTERNAL_CAPABILITIES,
    ExternalRootBinding,
    RepositoryRoot,
    external_roots_digest,
    repository_roots_digest,
)

_ENVIRONMENT_NAMES: Final = frozenset(
    {
        "CYBRIK_UAT_SUITE_ROOT",
        "CYBRIK_UAT_SOC_ROOT",
        "CYBRIK_UAT_CYBER_AI_ROOT",
        "CYBRIK_UAT_TOOL_FABRIC_ROOT",
        "CYBRIK_UAT_MASTER_EVIDENCE_ROOT",
        "CYBRIK_UAT_D2_RUNTIME_DIR",
        "CYBRIK_UAT_D2_EVIDENCE_DIR",
        "CYBRIK_UAT_RUNTIME_ROOT",
        "CYBRIK_UAT_EVIDENCE_ROOT",
        "CYBRIK_UAT_STATE_ROOT",
        "CYBRIK_UAT_B1_WHEEL",
        "CYBRIK_UAT_PYTHON",
    }
)
_REPOSITORY_ENVIRONMENT: Final = (
    ("suite", "CYBRIK_UAT_SUITE_ROOT"),
    ("soc", "CYBRIK_UAT_SOC_ROOT"),
    ("cyber_ai", "CYBRIK_UAT_CYBER_AI_ROOT"),
    ("tool_fabric", "CYBRIK_UAT_TOOL_FABRIC_ROOT"),
)
_PRIVATE_ROOT_ENVIRONMENT: Final = (
    "CYBRIK_UAT_MASTER_EVIDENCE_ROOT",
    "CYBRIK_UAT_D2_RUNTIME_DIR",
    "CYBRIK_UAT_D2_EVIDENCE_DIR",
    "CYBRIK_UAT_RUNTIME_ROOT",
    "CYBRIK_UAT_EVIDENCE_ROOT",
    "CYBRIK_UAT_STATE_ROOT",
)
_ROLE_ORDER: Final = tuple(role for role, _name in _REPOSITORY_ENVIRONMENT)
_HEX40 = re.compile(r"[0-9a-f]{40}\Z")
_HEX64 = re.compile(r"[0-9a-f]{64}\Z")
_D2_PURPOSE_NAMES: Final = (
    re.compile(r"cybrik-uat-d2-runtime-[a-z0-9][a-z0-9._-]{0,63}\Z"),
    re.compile(r"cybrik-uat-d2-evidence-[a-z0-9][a-z0-9._-]{0,63}\Z"),
)
_TRACKED_BLOB_ALGORITHM: Final = "cybrik-uat-tracked-blob-sha256-lines/v1"
_PREPARATION_SCHEMA: Final = "CYBRIK-INTEGRATED-UAT-PREPARATION-RECEIPT/v1"
_SIGNING_NAMESPACE: Final = "cybrik-uat-soc-ai-fabric-v1"
_GIT_ENV: Final = {
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_CONFIG_NOSYSTEM": "1",
    "LC_ALL": "C",
    "PATH": "/usr/bin:/bin",
}


class PreparationError(RuntimeError):
    """A stable, non-reflecting refusal to prepare an unsigned packet."""


@dataclass(frozen=True, slots=True)
class RepositoryExpectation:
    role: str
    root: Path


@dataclass(frozen=True, slots=True)
class RepositoryObservation:
    role: str
    root: Path
    commit: str
    tree: str
    clean: bool


@dataclass(frozen=True, slots=True)
class PreparationDependencies:
    helper_sha256: Callable[[Path, Path], str]
    observe_exact_tuple: Callable[[Sequence[object]], tuple[object, ...]]
    pinned_file_sha256: Callable[[Path], str]
    tracked_blob_aggregate: Callable[
        [Sequence[object], Mapping[str, Sequence[str]]], object
    ]


@dataclass(frozen=True, slots=True)
class PreparedAuthorization:
    bindings: object
    payload: bytes
    receipt: bytes
    protected_roots: tuple[Path, ...]


def _fail(reason: str) -> None:
    raise PreparationError(reason)


def _required(environment: Mapping[str, str], name: str) -> str:
    value = environment.get(name)
    if not isinstance(value, str) or not value:
        _fail("environment_missing")
    return value


def _canonical_directory(value: str, *, private: bool) -> Path:
    path = Path(value)
    try:
        observed = os.lstat(path)
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise PreparationError(
            "private_root_invalid" if private else "repository_root_invalid"
        ) from exc
    if (
        not path.is_absolute()
        or resolved != path
        or not stat.S_ISDIR(observed.st_mode)
        or (private and observed.st_uid != os.geteuid())
        or (private and stat.S_IMODE(observed.st_mode) != 0o700)
    ):
        _fail("private_root_invalid" if private else "repository_root_invalid")
    if private:
        try:
            if any(path.iterdir()):
                _fail("private_root_not_empty")
        except OSError as exc:
            raise PreparationError("private_root_invalid") from exc
    return path


def _canonical_file(value: str) -> Path:
    path = Path(value)
    try:
        observed = os.lstat(path)
        resolved = path.resolve(strict=True)
    except OSError as exc:
        raise PreparationError("pinned_file_invalid") from exc
    if (
        not path.is_absolute()
        or resolved != path
        or not stat.S_ISREG(observed.st_mode)
        or observed.st_nlink != 1
        or observed.st_size < 1
    ):
        _fail("pinned_file_invalid")
    return path


def _overlap(left: Path, right: Path) -> bool:
    return left == right or left.is_relative_to(right) or right.is_relative_to(left)


def _validated_roots(
    environment: Mapping[str, str],
) -> tuple[tuple[RepositoryExpectation, ...], tuple[Path, ...]]:
    repositories = tuple(
        RepositoryExpectation(
            role, _canonical_directory(_required(environment, name), private=False)
        )
        for role, name in _REPOSITORY_ENVIRONMENT
    )
    private_roots = tuple(
        _canonical_directory(_required(environment, name), private=True)
        for name in _PRIVATE_ROOT_ENVIRONMENT
    )
    roots = (*(item.root for item in repositories), *private_roots)
    if any(
        _overlap(left, right)
        for index, left in enumerate(roots)
        for right in roots[index + 1 :]
    ):
        _fail("roots_not_disjoint")
    if any(
        pattern.fullmatch(private_roots[index].name) is None
        for index, pattern in ((1, _D2_PURPOSE_NAMES[0]), (2, _D2_PURPOSE_NAMES[1]))
    ):
        _fail("postgres_root_not_purpose_bound")
    return repositories, private_roots


def _observation_identity(item: object) -> tuple[str, Path, str, str, bool]:
    try:
        identity = (
            item.role,
            item.root,
            item.commit,
            item.tree,
            item.clean,
        )
    except AttributeError as exc:
        raise PreparationError("repository_observation_invalid") from exc
    role, root, commit, tree, clean = identity
    if (
        not isinstance(role, str)
        or not isinstance(root, Path)
        or not isinstance(commit, str)
        or not isinstance(tree, str)
        or not isinstance(clean, bool)
    ):
        _fail("repository_observation_invalid")
    return role, root, commit, tree, clean


def _validated_observations(
    raw: object, expectations: tuple[RepositoryExpectation, ...]
) -> tuple[object, ...]:
    if not isinstance(raw, tuple) or len(raw) != len(expectations):
        _fail("repository_observation_invalid")
    identities = tuple(_observation_identity(item) for item in raw)
    if (
        tuple(item[0] for item in identities) != _ROLE_ORDER
        or tuple(item[1] for item in identities)
        != tuple(item.root for item in expectations)
        or any(_HEX40.fullmatch(item[2]) is None for item in identities)
        or any(_HEX40.fullmatch(item[3]) is None for item in identities)
    ):
        _fail("repository_observation_invalid")
    if any(item[4] is not True for item in identities):
        _fail("repository_not_clean")
    return raw


def _sha256(value: object, reason: str) -> str:
    if not isinstance(value, str) or _HEX64.fullmatch(value) is None:
        _fail(reason)
    return value


def _canonical_receipt(payload: bytes, authorization_id: str) -> bytes:
    document = {
        "authorization_id": authorization_id,
        "payload_sha256": hashlib.sha256(payload).hexdigest(),
        "schema": _PREPARATION_SCHEMA,
        "signing_argv_template": [
            "/usr/bin/ssh-keygen",
            "-Y",
            "sign",
            "-f",
            "<PRIVATE_KEY_PATH>",
            "-n",
            _SIGNING_NAMESPACE,
            "<AUTHORIZATION_PAYLOAD_PATH>",
        ],
        "status": "PREPARED_UNSIGNED",
    }
    return json.dumps(
        document, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def prepare_master_authorization(
    environment: Mapping[str, str],
    *,
    authorization_id: str,
    authorized_by: str,
    issued_at: datetime,
    expires_at: datetime,
    dependencies: PreparationDependencies | None = None,
) -> PreparedAuthorization:
    """Freeze one unsigned packet without signing, consuming, or starting runtime."""

    unknown = {
        name
        for name in environment
        if name.startswith("CYBRIK_UAT_") and name not in _ENVIRONMENT_NAMES
    }
    if unknown:
        _fail("environment_unknown")
    expectations, private_roots = _validated_roots(environment)
    suite_root = expectations[0].root
    try:
        selected = dependencies or _default_dependencies(suite_root)
    except PreparationError:
        raise
    except Exception as exc:
        raise PreparationError("dependencies_invalid") from exc
    try:
        first = _validated_observations(
            selected.observe_exact_tuple(expectations), expectations
        )
        aggregate = selected.tracked_blob_aggregate(
            first, admission.MASTER_TRACKED_ALLOWLIST
        )
    except PreparationError:
        raise
    except Exception as exc:
        raise PreparationError("repository_observation_failed") from exc
    if getattr(aggregate, "algorithm", None) != _TRACKED_BLOB_ALGORITHM or getattr(
        aggregate, "file_count", None
    ) != sum(len(paths) for paths in admission.MASTER_TRACKED_ALLOWLIST.values()):
        _fail("tracked_blob_aggregate_invalid")
    aggregate_sha256 = _sha256(
        getattr(aggregate, "sha256", None), "tracked_blob_aggregate_invalid"
    )
    try:
        helper_scripts = tuple(
            {
                "path": relative.as_posix(),
                "sha256": _sha256(
                    selected.helper_sha256(suite_root, relative), "helper_invalid"
                ),
            }
            for relative in admission.HELPER_SCRIPTS
        )
        b1_wheel = _canonical_file(_required(environment, "CYBRIK_UAT_B1_WHEEL"))
        python = _canonical_file(_required(environment, "CYBRIK_UAT_PYTHON"))
        b1_sha256 = _sha256(
            selected.pinned_file_sha256(b1_wheel), "pinned_file_invalid"
        )
        python_sha256 = _sha256(
            selected.pinned_file_sha256(python), "pinned_file_invalid"
        )
    except PreparationError:
        raise
    except Exception as exc:
        raise PreparationError("binding_collection_failed") from exc
    try:
        second = _validated_observations(
            selected.observe_exact_tuple(expectations), expectations
        )
    except PreparationError:
        raise
    except Exception as exc:
        raise PreparationError("repository_observation_failed") from exc
    if tuple(_observation_identity(item) for item in first) != tuple(
        _observation_identity(item) for item in second
    ):
        _fail("repository_changed")

    repository_roots = (
        RepositoryRoot("cybrik-soc-command-center", expectations[1].root),
        RepositoryRoot("cybrik-cyber-ai-platform", expectations[2].root),
        RepositoryRoot("cybrik-security-tool-fabric", expectations[3].root),
        RepositoryRoot("cybrik-suite", expectations[0].root),
    )
    external_roots = tuple(
        ExternalRootBinding(capability, root)
        for capability, root in zip(
            EXPECTED_EXTERNAL_CAPABILITIES, private_roots[1:], strict=True
        )
    )
    try:
        from . import authorization_packet

        bindings = authorization_packet.MasterBindingInputs(
            authorization_id=authorization_id,
            authorized_by=authorized_by,
            issued_at=issued_at,
            expires_at=expires_at,
            b1_wheel={"path": str(b1_wheel), "sha256": b1_sha256},
            evidence_root=str(private_roots[0]),
            external_roots=tuple(item.to_dict() for item in external_roots),
            external_roots_sha256=external_roots_digest(external_roots),
            helper_scripts=helper_scripts,
            python={"path": str(python), "sha256": python_sha256},
            repository_roots=tuple(item.to_dict() for item in repository_roots),
            repository_roots_sha256=repository_roots_digest(repository_roots),
            repository_tuple=tuple(
                (item.role, item.commit, item.tree) for item in first
            ),
            tracked_blob_aggregate={
                "algorithm": aggregate.algorithm,
                "file_count": aggregate.file_count,
                "sha256": aggregate_sha256,
            },
        )
        payload = authorization_packet.canonical_master_payload(bindings)
    except (ImportError, AttributeError, TypeError, ValueError) as exc:
        raise PreparationError("authorization_binding_invalid") from exc
    return PreparedAuthorization(
        bindings=bindings,
        payload=payload,
        receipt=_canonical_receipt(payload, authorization_id),
        protected_roots=(*(item.root for item in expectations), *private_roots),
    )


def _git(root: Path, *arguments: str) -> str:
    try:
        result = subprocess.run(
            ("/usr/bin/git", "-C", str(root), *arguments),
            check=True,
            capture_output=True,
            env=_GIT_ENV,
            timeout=15,
        )
        return result.stdout.decode("utf-8").rstrip("\n")
    except (OSError, UnicodeDecodeError, subprocess.SubprocessError) as exc:
        raise PreparationError("repository_observation_failed") from exc


def _observe_exact_tuple(
    expectations: Sequence[object],
) -> tuple[RepositoryObservation, ...]:
    observations: list[RepositoryObservation] = []
    for expectation in expectations:
        if not isinstance(expectation, RepositoryExpectation):
            _fail("repository_observation_invalid")
        if _git(expectation.root, "rev-parse", "--show-toplevel") != str(
            expectation.root
        ):
            _fail("repository_observation_invalid")
        observations.append(
            RepositoryObservation(
                role=expectation.role,
                root=expectation.root,
                commit=_git(expectation.root, "rev-parse", "HEAD^{commit}"),
                tree=_git(expectation.root, "rev-parse", "HEAD^{tree}"),
                clean=not bool(
                    _git(
                        expectation.root,
                        "status",
                        "--porcelain=v1",
                        "--untracked-files=all",
                    )
                ),
            )
        )
    return tuple(observations)


def _default_dependencies(suite_root: Path) -> PreparationDependencies:
    selected = admission._default_dependencies(suite_root)
    return PreparationDependencies(
        helper_sha256=selected.helper_sha256,
        observe_exact_tuple=_observe_exact_tuple,
        pinned_file_sha256=admission._pinned_file_sha256,
        tracked_blob_aggregate=selected.tracked_blob_aggregate,
    )


@dataclass(frozen=True, slots=True)
class _OutputTarget:
    path: Path
    parent: Path
    name: str
    parent_identity: tuple[int, int]


def _output_target(path: object) -> _OutputTarget:
    if not isinstance(path, Path) or not path.is_absolute() or not path.name:
        _fail("output_invalid")
    parent = path.parent
    try:
        observed = os.lstat(parent)
        resolved = parent.resolve(strict=True)
    except OSError as exc:
        raise PreparationError("output_invalid") from exc
    if (
        resolved != parent
        or resolved / path.name != path
        or not stat.S_ISDIR(observed.st_mode)
        or observed.st_uid != os.geteuid()
        or stat.S_IMODE(observed.st_mode) != 0o700
    ):
        _fail("output_invalid")
    try:
        os.lstat(path)
    except FileNotFoundError:
        pass
    except OSError as exc:
        raise PreparationError("output_invalid") from exc
    else:
        _fail("output_invalid")
    return _OutputTarget(
        path=path,
        parent=parent,
        name=path.name,
        parent_identity=(observed.st_dev, observed.st_ino),
    )


def _open_parent(target: _OutputTarget) -> int:
    no_follow = getattr(os, "O_NOFOLLOW", 0)
    close_on_exec = getattr(os, "O_CLOEXEC", 0)
    directory = getattr(os, "O_DIRECTORY", 0)
    if not no_follow or not close_on_exec or not directory:
        _fail("output_invalid")
    descriptor: int | None = None
    try:
        descriptor = os.open(
            target.parent, os.O_RDONLY | directory | no_follow | close_on_exec
        )
        observed = os.fstat(descriptor)
    except OSError as exc:
        if descriptor is not None:
            os.close(descriptor)
        raise PreparationError("output_invalid") from exc
    if (
        not stat.S_ISDIR(observed.st_mode)
        or observed.st_uid != os.geteuid()
        or stat.S_IMODE(observed.st_mode) != 0o700
        or (observed.st_dev, observed.st_ino) != target.parent_identity
    ):
        os.close(descriptor)
        _fail("output_invalid")
    return descriptor


def _unlink_created(target: _OutputTarget, identity: tuple[int, int]) -> None:
    parent_descriptor: int | None = None
    try:
        parent_descriptor = _open_parent(target)
        observed = os.stat(target.name, dir_fd=parent_descriptor, follow_symlinks=False)
        if (observed.st_dev, observed.st_ino) == identity:
            os.unlink(target.name, dir_fd=parent_descriptor)
            os.fsync(parent_descriptor)
    except (OSError, PreparationError):
        return
    finally:
        if parent_descriptor is not None:
            os.close(parent_descriptor)


def _exclusive_write(target: _OutputTarget, payload: bytes) -> tuple[int, int]:
    no_follow = getattr(os, "O_NOFOLLOW", 0)
    close_on_exec = getattr(os, "O_CLOEXEC", 0)
    if not no_follow or not close_on_exec:
        _fail("output_invalid")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | no_follow | close_on_exec
    parent_descriptor = _open_parent(target)
    try:
        descriptor = os.open(target.name, flags, 0o600, dir_fd=parent_descriptor)
    except OSError as exc:
        os.close(parent_descriptor)
        raise PreparationError("output_invalid") from exc
    identity: tuple[int, int] | None = None
    try:
        created = os.fstat(descriptor)
        identity = (created.st_dev, created.st_ino)
        if (
            not stat.S_ISREG(created.st_mode)
            or created.st_nlink != 1
            or created.st_uid != os.geteuid()
        ):
            _fail("output_invalid")
        os.fchmod(descriptor, 0o600)
        offset = 0
        while offset < len(payload):
            written = os.write(descriptor, payload[offset:])
            if written < 1:
                _fail("output_invalid")
            offset += written
        os.fsync(descriptor)
        final = os.fstat(descriptor)
        if (
            stat.S_IMODE(final.st_mode) != 0o600
            or final.st_nlink != 1
            or final.st_size != len(payload)
            or (final.st_dev, final.st_ino) != identity
        ):
            _fail("output_invalid")
        os.fsync(parent_descriptor)
        return identity
    except (OSError, PreparationError) as exc:
        if identity is not None:
            _unlink_created(target, identity)
        if isinstance(exc, PreparationError):
            raise
        raise PreparationError("output_invalid") from exc
    finally:
        os.close(descriptor)
        os.close(parent_descriptor)


def write_prepared_authorization(
    prepared: PreparedAuthorization,
    *,
    payload_path: Path,
    receipt_path: Path,
) -> None:
    """Write the unsigned payload and receipt once, never replacing an artifact."""

    if not isinstance(prepared, PreparedAuthorization):
        _fail("prepared_authorization_invalid")
    if payload_path == receipt_path:
        _fail("output_paths_not_disjoint")
    payload_target = _output_target(payload_path)
    receipt_target = _output_target(receipt_path)
    if _overlap(payload_target.path, receipt_target.path):
        _fail("output_paths_not_disjoint")
    if any(
        _overlap(target.path, protected)
        for target in (payload_target, receipt_target)
        for protected in prepared.protected_roots
    ):
        _fail("output_overlaps_protected_root")
    payload_identity = _exclusive_write(payload_target, prepared.payload)
    try:
        _exclusive_write(receipt_target, prepared.receipt)
    except PreparationError:
        _unlink_created(payload_target, payload_identity)
        raise
