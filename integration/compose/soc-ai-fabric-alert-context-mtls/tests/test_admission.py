"""Synthetic tests for the four-repository UAT admission boundary."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_fabric import admission

_ROLES = ("suite", "soc", "cyber_ai", "tool_fabric")
_ROLE_HEX = {
    "suite": ("1", "5"),
    "soc": ("2", "6"),
    "cyber_ai": ("3", "7"),
    "tool_fabric": ("4", "8"),
}
_NOW = datetime(2026, 8, 3, 8, 0, tzinfo=UTC)


class FakeGit:
    def __init__(
        self, roots: dict[str, Path], *, dirty_role: str | None = None
    ) -> None:
        self._role_by_root = {root: role for role, root in roots.items()}
        self._dirty_role = dirty_role
        self._blobs = {
            ("suite", "integration/harness.py"): b"suite harness\n",
            ("soc", "services/api.py"): b"soc api\n",
            ("cyber_ai", "services/ai.py"): b"ai service\n",
            ("tool_fabric", "src/runtime.py"): b"fabric runtime\n",
        }

    def __call__(self, root: Path, arguments: tuple[str, ...]) -> bytes:
        role = self._role_by_root[root]
        commit = _ROLE_HEX[role][0] * 40
        tree = _ROLE_HEX[role][1] * 40
        if arguments == ("rev-parse", "--show-toplevel"):
            return f"{root}\n".encode()
        if arguments == ("rev-parse", "HEAD^{commit}"):
            return f"{commit}\n".encode()
        if arguments == ("rev-parse", "HEAD^{tree}"):
            return f"{tree}\n".encode()
        if arguments == ("status", "--porcelain=v1", "--untracked-files=all"):
            return b" M services/api.py\n" if role == self._dirty_role else b""
        if arguments[:4] == ("ls-tree", "-z", "HEAD", "--"):
            relative = arguments[4]
            blob = self._blobs[(role, relative)]
            oid = hashlib.sha1(b"blob %d\0" % len(blob) + blob).hexdigest()
            return f"100644 blob {oid}\t{relative}\0".encode()
        if arguments[:2] == ("cat-file", "blob"):
            _, relative = arguments[2].split(":", 1)
            return self._blobs[(role, relative)]
        raise AssertionError(arguments)


def _roots(tmp_path: Path) -> dict[str, Path]:
    roots: dict[str, Path] = {}
    for role in _ROLES:
        root = (tmp_path / role).resolve()
        root.mkdir()
        roots[role] = root
    return roots


def _expectations(roots: dict[str, Path]) -> tuple[admission.RepoExpectation, ...]:
    return tuple(
        admission.RepoExpectation(
            role=role,
            root=roots[role],
            commit=_ROLE_HEX[role][0] * 40,
            tree=_ROLE_HEX[role][1] * 40,
        )
        for role in _ROLES
    )


def _allowlist() -> dict[str, tuple[str, ...]]:
    return {
        "suite": ("integration/harness.py",),
        "soc": ("services/api.py",),
        "cyber_ai": ("services/ai.py",),
        "tool_fabric": ("src/runtime.py",),
    }


def _authorization_payload(
    observations: tuple[admission.RepositoryObservation, ...],
    aggregate: admission.TrackedBlobAggregate,
) -> bytes:
    record = {
        "authorization_id": "uat-soc-ai-fabric-r1",
        "authorized_by": "FOUNDER",
        "decision": "APPROVE",
        "expires_at": (_NOW + timedelta(hours=1)).isoformat(),
        "issued_at": (_NOW - timedelta(minutes=1)).isoformat(),
        "one_shot": True,
        "schema": admission.AUTHORIZATION_SCHEMA,
        "tracked_blob_aggregate": {
            "algorithm": aggregate.algorithm,
            "file_count": aggregate.file_count,
            "sha256": aggregate.sha256,
        },
        "tuple": {
            item.role: {"commit": item.commit, "tree": item.tree}
            for item in observations
        },
    }
    return json.dumps(record, sort_keys=True, separators=(",", ":")).encode()


def _write_external(path: Path, payload: bytes) -> None:
    path.write_bytes(payload)
    path.chmod(0o600)


def test_exact_tuple_and_allowlisted_tracked_blob_aggregate_are_admitted(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)

    observations = admission.observe_exact_tuple(_expectations(roots), git=git)
    aggregate = admission.tracked_blob_aggregate(observations, _allowlist(), git=git)

    assert tuple(item.role for item in observations) == _ROLES
    assert aggregate.algorithm == admission.TRACKED_BLOB_ALGORITHM
    assert aggregate.file_count == 4
    assert len(aggregate.sha256) == 64


def test_tuple_rejects_dirty_root_and_never_calculates_an_aggregate(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)

    with pytest.raises(admission.AdmissionFailure, match="repository_not_clean"):
        admission.observe_exact_tuple(
            _expectations(roots), git=FakeGit(roots, dirty_role="soc")
        )


def test_default_git_reader_fails_closed_for_a_non_repository(tmp_path: Path) -> None:
    roots = _roots(tmp_path)

    with pytest.raises(
        admission.AdmissionFailure, match="repository_inspection_failed"
    ):
        admission.observe_exact_tuple(_expectations(roots))


def test_tuple_rejects_duplicate_roots_top_level_and_tree_drift(tmp_path: Path) -> None:
    roots = _roots(tmp_path)
    expectations = _expectations(roots)
    duplicate = (
        expectations[0],
        admission.RepoExpectation(
            role="soc",
            root=expectations[0].root,
            commit=expectations[1].commit,
            tree=expectations[1].tree,
        ),
        *expectations[2:],
    )
    with pytest.raises(admission.AdmissionFailure, match="repository_root_reused"):
        admission.observe_exact_tuple(duplicate, git=FakeGit(roots))

    class TopLevelDrift(FakeGit):
        def __call__(self, root: Path, arguments: tuple[str, ...]) -> bytes:
            if self._role_by_root[root] == "soc" and arguments == (
                "rev-parse",
                "--show-toplevel",
            ):
                return b"/unexpected\n"
            return super().__call__(root, arguments)

    with pytest.raises(
        admission.AdmissionFailure, match="repository_top_level_mismatch"
    ):
        admission.observe_exact_tuple(expectations, git=TopLevelDrift(roots))

    drifted_tree = tuple(
        admission.RepoExpectation(
            role=item.role,
            root=item.root,
            commit=item.commit,
            tree="0" * 40 if item.role == "soc" else item.tree,
        )
        for item in expectations
    )
    with pytest.raises(admission.AdmissionFailure, match="repository_tree_mismatch"):
        admission.observe_exact_tuple(drifted_tree, git=FakeGit(roots))


@pytest.mark.parametrize(
    "mutator,reason",
    (
        (
            lambda values: values[:-1],
            "repository_role_set_mismatch",
        ),
        (
            lambda values: (*values[:-1], values[0]),
            "repository_role_set_mismatch",
        ),
        (
            lambda values: (
                *values[:-1],
                admission.RepoExpectation(
                    role=values[-1].role,
                    root=values[-1].root,
                    commit="0" * 40,
                    tree=values[-1].tree,
                ),
            ),
            "repository_commit_mismatch",
        ),
    ),
)
def test_tuple_is_exact_and_fail_closed(
    tmp_path: Path, mutator: object, reason: str
) -> None:
    roots = _roots(tmp_path)
    expected = _expectations(roots)
    changed = mutator(expected)  # type: ignore[operator]

    with pytest.raises(admission.AdmissionFailure, match=reason):
        admission.observe_exact_tuple(changed, git=FakeGit(roots))


@pytest.mark.parametrize(
    "path",
    ("/absolute.py", "../escape.py", "a/../../escape.py", "", ".git/config"),
)
def test_aggregate_rejects_noncanonical_or_metadata_paths(
    tmp_path: Path, path: str
) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)
    observations = admission.observe_exact_tuple(_expectations(roots), git=git)
    allowlist = _allowlist()
    allowlist["suite"] = (path,)

    with pytest.raises(admission.AdmissionFailure, match="allowlist_path_invalid"):
        admission.tracked_blob_aggregate(observations, allowlist, git=git)


def test_aggregate_rejects_role_order_allowlist_order_and_non_blob(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)
    observations = admission.observe_exact_tuple(_expectations(roots), git=git)

    with pytest.raises(
        admission.AdmissionFailure, match="repository_role_set_mismatch"
    ):
        admission.tracked_blob_aggregate(observations[::-1], _allowlist(), git=git)
    with pytest.raises(admission.AdmissionFailure, match="allowlist_role_set_mismatch"):
        admission.tracked_blob_aggregate(
            observations, {"suite": ("integration/harness.py",)}, git=git
        )
    duplicated = _allowlist()
    duplicated["suite"] = ("integration/harness.py", "integration/harness.py")
    with pytest.raises(
        admission.AdmissionFailure, match="allowlist_paths_not_unique_sorted"
    ):
        admission.tracked_blob_aggregate(observations, duplicated, git=git)

    class NotABlob(FakeGit):
        def __call__(self, root: Path, arguments: tuple[str, ...]) -> bytes:
            if arguments[:4] == ("ls-tree", "-z", "HEAD", "--"):
                relative = arguments[4]
                return f"040000 tree {'1' * 40}\t{relative}\0".encode()
            return super().__call__(root, arguments)

    with pytest.raises(admission.AdmissionFailure, match="allowlisted_blob_invalid"):
        admission.tracked_blob_aggregate(
            observations, _allowlist(), git=NotABlob(roots)
        )


def test_external_signed_authorization_is_exact_and_consumed_once(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)
    observations = admission.observe_exact_tuple(_expectations(roots), git=git)
    aggregate = admission.tracked_blob_aggregate(observations, _allowlist(), git=git)
    payload = _authorization_payload(observations, aggregate)
    authorization_path = tmp_path / "authorization.json"
    signature_path = tmp_path / "authorization.sig"
    _write_external(authorization_path, payload)
    _write_external(signature_path, b"synthetic detached signature")

    grant = admission.admit_external_authorization(
        authorization_path=authorization_path,
        signature_path=signature_path,
        observations=observations,
        aggregate=aggregate,
        verifier=lambda message, signature: (
            "FOUNDER" if message == payload and bool(signature) else None
        ),
        now=_NOW,
    )
    assert grant.exact is True
    assert grant.external is True
    assert grant.one_shot is True
    assert grant.consumed is False
    state_root = (tmp_path / "state").resolve()
    state_root.mkdir(mode=0o700)
    state_root.chmod(0o700)

    marker = admission.consume_once(
        grant,
        state_root=state_root,
        repository_roots=tuple(roots.values()),
        allowlist=_allowlist(),
        git=git,
        now=_NOW,
    )

    assert marker.stat().st_mode & 0o777 == 0o600
    assert (
        json.loads(marker.read_text())["authorization_sha256"]
        == hashlib.sha256(payload).hexdigest()
    )
    with pytest.raises(
        admission.AdmissionFailure, match="authorization_already_consumed"
    ):
        admission.consume_once(
            grant,
            state_root=state_root,
            repository_roots=tuple(roots.values()),
            allowlist=_allowlist(),
            git=git,
            now=_NOW,
        )


def test_authorization_rejects_bad_signature_expiry_and_world_readable_file(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)
    observations = admission.observe_exact_tuple(_expectations(roots), git=git)
    aggregate = admission.tracked_blob_aggregate(observations, _allowlist(), git=git)
    authorization_path = tmp_path / "authorization.json"
    signature_path = tmp_path / "authorization.sig"
    _write_external(authorization_path, _authorization_payload(observations, aggregate))
    _write_external(signature_path, b"signature")

    with pytest.raises(
        admission.AdmissionFailure, match="authorization_signature_invalid"
    ):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: None,
            now=_NOW,
        )

    with pytest.raises(admission.AdmissionFailure, match="authorization_not_current"):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: "FOUNDER",
            now=_NOW + timedelta(hours=2),
        )

    with pytest.raises(admission.AdmissionFailure, match="authorization_clock_invalid"):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: "FOUNDER",
            now=_NOW.replace(tzinfo=None),
        )

    authorization_path.chmod(0o644)
    with pytest.raises(admission.AdmissionFailure, match="external_file_mode_invalid"):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: "FOUNDER",
            now=_NOW,
        )


def test_external_file_reader_rejects_symlink_hardlink_and_descriptor_drift(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "target.json"
    _write_external(target, b"{}")
    symlink = tmp_path / "symlink.json"
    symlink.symlink_to(target)
    with pytest.raises(admission.AdmissionFailure, match="external_file_invalid"):
        admission._read_external_file(symlink)

    hardlink = tmp_path / "hardlink.json"
    os.link(target, hardlink)
    with pytest.raises(admission.AdmissionFailure, match="external_file_invalid"):
        admission._read_external_file(target)
    hardlink.unlink()

    real_fstat = admission.os.fstat
    calls = 0

    def changing_fstat(descriptor: int) -> object:
        nonlocal calls
        calls += 1
        observed = real_fstat(descriptor)
        if calls == 2:
            return SimpleNamespace(
                st_mode=observed.st_mode,
                st_uid=observed.st_uid,
                st_dev=observed.st_dev,
                st_ino=observed.st_ino,
                st_nlink=observed.st_nlink,
                st_size=observed.st_size,
                st_mtime_ns=observed.st_mtime_ns + 1,
                st_ctime_ns=observed.st_ctime_ns,
            )
        return observed

    monkeypatch.setattr(admission.os, "fstat", changing_fstat)
    with pytest.raises(admission.AdmissionFailure, match="external_file_changed"):
        admission._read_external_file(target)


def test_external_file_reader_rejects_path_replacement_during_read(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "authorization.json"
    replacement = tmp_path / "replacement.json"
    _write_external(target, b"original")
    _write_external(replacement, b"replaced")
    real_read = admission.os.read
    swapped = False

    def swapping_read(descriptor: int, length: int) -> bytes:
        nonlocal swapped
        payload = real_read(descriptor, length)
        if payload and not swapped:
            swapped = True
            os.replace(replacement, target)
        return payload

    monkeypatch.setattr(admission.os, "read", swapping_read)
    with pytest.raises(admission.AdmissionFailure, match="external_file_changed"):
        admission._read_external_file(target)


def test_external_signer_identity_must_equal_signed_authorized_by(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)
    observations = admission.observe_exact_tuple(_expectations(roots), git=git)
    aggregate = admission.tracked_blob_aggregate(observations, _allowlist(), git=git)
    record = json.loads(_authorization_payload(observations, aggregate))
    record["authorized_by"] = "CODEX-GOVERNOR"
    payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode()
    authorization_path = tmp_path / "authorization.json"
    signature_path = tmp_path / "authorization.sig"
    _write_external(authorization_path, payload)
    _write_external(signature_path, b"signature")

    grant = admission.admit_external_authorization(
        authorization_path=authorization_path,
        signature_path=signature_path,
        observations=observations,
        aggregate=aggregate,
        verifier=lambda _message, _signature: "CODEX-GOVERNOR",
        now=_NOW,
    )
    assert grant.authorization_id == "uat-soc-ai-fabric-r1"

    with pytest.raises(
        admission.AdmissionFailure, match="authorization_signature_invalid"
    ):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: "FOUNDER",
            now=_NOW,
        )


def test_authorization_rejects_tuple_or_aggregate_drift(tmp_path: Path) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)
    observations = admission.observe_exact_tuple(_expectations(roots), git=git)
    aggregate = admission.tracked_blob_aggregate(observations, _allowlist(), git=git)
    record = json.loads(_authorization_payload(observations, aggregate))
    record["tuple"]["soc"]["tree"] = "0" * 40
    payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode()
    authorization_path = tmp_path / "authorization.json"
    signature_path = tmp_path / "authorization.sig"
    _write_external(authorization_path, payload)
    _write_external(signature_path, b"signature")

    with pytest.raises(
        admission.AdmissionFailure, match="authorization_tuple_mismatch"
    ):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: "FOUNDER",
            now=_NOW,
        )

    record = json.loads(_authorization_payload(observations, aggregate))
    record["tracked_blob_aggregate"]["sha256"] = "0" * 64
    payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode()
    _write_external(authorization_path, payload)
    with pytest.raises(
        admission.AdmissionFailure, match="authorization_aggregate_mismatch"
    ):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: "FOUNDER",
            now=_NOW,
        )


def test_external_authorization_rejects_noncanonical_unknown_and_policy_fields(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)
    observations = admission.observe_exact_tuple(_expectations(roots), git=git)
    aggregate = admission.tracked_blob_aggregate(observations, _allowlist(), git=git)
    authorization_path = tmp_path / "authorization.json"
    signature_path = tmp_path / "authorization.sig"
    _write_external(signature_path, b"signature")

    canonical = _authorization_payload(observations, aggregate)
    _write_external(authorization_path, canonical + b"\n")
    with pytest.raises(admission.AdmissionFailure, match="authorization_not_canonical"):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: "FOUNDER",
            now=_NOW,
        )

    record = json.loads(canonical)
    record["unexpected"] = True
    _write_external(
        authorization_path,
        json.dumps(record, sort_keys=True, separators=(",", ":")).encode(),
    )
    with pytest.raises(
        admission.AdmissionFailure, match="authorization_fields_invalid"
    ):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: "FOUNDER",
            now=_NOW,
        )

    record.pop("unexpected")
    record["decision"] = "HOLD"
    _write_external(
        authorization_path,
        json.dumps(record, sort_keys=True, separators=(",", ":")).encode(),
    )
    with pytest.raises(
        admission.AdmissionFailure, match="authorization_policy_invalid"
    ):
        admission.admit_external_authorization(
            authorization_path=authorization_path,
            signature_path=signature_path,
            observations=observations,
            aggregate=aggregate,
            verifier=lambda _message, _signature: "FOUNDER",
            now=_NOW,
        )


def test_consumption_rejects_invalid_or_in_repository_state_root(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)
    observations = admission.observe_exact_tuple(_expectations(roots), git=git)
    aggregate = admission.tracked_blob_aggregate(observations, _allowlist(), git=git)
    payload = _authorization_payload(observations, aggregate)
    authorization_path = tmp_path / "authorization.json"
    signature_path = tmp_path / "authorization.sig"
    _write_external(authorization_path, payload)
    _write_external(signature_path, b"signature")
    grant = admission.admit_external_authorization(
        authorization_path=authorization_path,
        signature_path=signature_path,
        observations=observations,
        aggregate=aggregate,
        verifier=lambda _message, _signature: "FOUNDER",
        now=_NOW,
    )

    with pytest.raises(admission.AdmissionFailure, match="authorization_invalid"):
        admission.consume_once(
            object(),  # type: ignore[arg-type]
            state_root=tmp_path / "missing-state",
            repository_roots=tuple(roots.values()),
            allowlist=_allowlist(),
            git=git,
            now=_NOW,
        )
    with pytest.raises(admission.AdmissionFailure, match="state_root_invalid"):
        admission.consume_once(
            grant,
            state_root=tmp_path / "missing-state",
            repository_roots=tuple(roots.values()),
            allowlist=_allowlist(),
            git=git,
            now=_NOW,
        )

    inside = roots["suite"] / "state"
    inside.mkdir(mode=0o700)
    inside.chmod(0o700)
    with pytest.raises(
        admission.AdmissionFailure, match="state_root_inside_repository"
    ):
        admission.consume_once(
            grant,
            state_root=inside,
            repository_roots=tuple(roots.values()),
            allowlist=_allowlist(),
            git=git,
            now=_NOW,
        )


def test_consumption_reobserves_clean_tuple_before_writing_marker(
    tmp_path: Path,
) -> None:
    roots = _roots(tmp_path)
    git = FakeGit(roots)
    observations = admission.observe_exact_tuple(_expectations(roots), git=git)
    aggregate = admission.tracked_blob_aggregate(observations, _allowlist(), git=git)
    payload = _authorization_payload(observations, aggregate)
    authorization_path = tmp_path / "authorization.json"
    signature_path = tmp_path / "authorization.sig"
    _write_external(authorization_path, payload)
    _write_external(signature_path, b"signature")
    grant = admission.admit_external_authorization(
        authorization_path=authorization_path,
        signature_path=signature_path,
        observations=observations,
        aggregate=aggregate,
        verifier=lambda _message, _signature: "FOUNDER",
        now=_NOW,
    )
    state_root = (tmp_path / "state").resolve()
    state_root.mkdir(mode=0o700)
    state_root.chmod(0o700)

    with pytest.raises(admission.AdmissionFailure, match="repository_not_clean"):
        admission.consume_once(
            grant,
            state_root=state_root,
            repository_roots=tuple(roots.values()),
            allowlist=_allowlist(),
            git=FakeGit(roots, dirty_role="tool_fabric"),
            now=_NOW,
        )
    assert list(state_root.iterdir()) == []
