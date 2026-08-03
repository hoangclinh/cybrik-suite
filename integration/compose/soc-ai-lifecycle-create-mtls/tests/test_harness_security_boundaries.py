"""RED contracts for D2 harness process, provenance, and TLS boundaries.

These tests are deliberately synthetic.  They do not inspect or signal a real
process, open a TLS socket, execute Git, or start any Suite runtime component.
Process authority is the authenticated control binding alone: no numeric
process identifier, ``ps`` inspection, or directly owned ``Popen`` handle may
ever stand in for it.
"""

from __future__ import annotations

import stat
from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_mtls import harness, process_control
from cybrik_suite_uat_mtls import runtime_authorization as runtime_auth

_AUTHORIZATION_SHA256 = "a" * 64
_AUTHORIZATION_ID = "d2-runtime-auth-boundaries"
_RUNTIME_ROOT = Path("/opt/cybrik-uat-d2-runtime-boundaries")
_CAPABILITY = b"k" * process_control.CAPABILITY_BYTES


def _authorization() -> SimpleNamespace:
    return SimpleNamespace(
        authorization_id=_AUTHORIZATION_ID,
        authorization_sha256=_AUTHORIZATION_SHA256,
        runtime_root=_RUNTIME_ROOT,
        evidence_root=Path("/opt/cybrik-uat-d2-evidence-boundaries"),
    )


class _StableRead:
    def __init__(self, data: bytes, identity: process_control.RootIdentity) -> None:
        self.data = data
        self.before = identity
        self.after = identity


class _FakeControlFileSystem:
    """In-memory control root: no descriptor, socket, or pathname is opened."""

    def __init__(
        self,
        *,
        binding: process_control.ControlBinding,
        capability: bytes = _CAPABILITY,
        signed_root_identity: process_control.RootIdentity | None = None,
    ) -> None:
        self.root_handle = object()
        self.opened: list[tuple[Path, bool]] = []
        self.reads: list[str] = []
        self.root_identity = process_control.RootIdentity(
            device=7,
            inode=11,
            owner_uid=binding.owner_uid,
            mode=stat.S_IFDIR | 0o700,
        )
        self.leaf_identity = process_control.RootIdentity(
            device=7,
            inode=21,
            owner_uid=binding.owner_uid,
            mode=stat.S_IFREG | 0o600,
        )
        persisted = process_control.PersistedControlBinding(
            binding, signed_root_identity or self.root_identity
        )
        self.entries = {
            "capability.bin": capability,
            "binding.json": process_control.sign_frame(
                persisted.as_payload(), capability
            ),
        }

    def open_directory(self, path: Path, *, nofollow: bool) -> object:
        self.opened.append((path, nofollow))
        return self.root_handle

    def stat_handle(self, handle: object) -> process_control.RootIdentity:
        assert handle is self.root_handle
        return self.root_identity

    def stat_directory(
        self, path: Path, *, nofollow: bool
    ) -> process_control.RootIdentity:
        del path, nofollow
        return self.root_identity

    def read_at_stable(
        self,
        handle: object,
        name: str,
        *,
        max_bytes: int,
        mode: int,
        owner_uid: int,
        nofollow: bool,
    ) -> _StableRead:
        assert handle is self.root_handle
        assert (mode, owner_uid, nofollow) == (
            0o600,
            self.root_identity.owner_uid,
            True,
        )
        self.reads.append(name)
        return _StableRead(self.entries[name][: max_bytes + 1], self.leaf_identity)


def test_control_material_binds_the_exact_authorization_digest_and_root_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``_load_control`` admits only an HMAC-bound store, material, and client."""

    authorization = _authorization()
    binding = harness._control_binding(authorization)  # type: ignore[arg-type]
    filesystem = _FakeControlFileSystem(binding=binding)
    monkeypatch.setattr(
        harness.process_control,
        "PosixFileSystemAdapter",
        lambda: filesystem,
    )

    control_store, material, client = harness._load_control(
        authorization  # type: ignore[arg-type]
    )

    assert isinstance(control_store, process_control.ControlStore)
    assert isinstance(client, process_control.ControlClient)
    assert binding.authorization_sha256 == _AUTHORIZATION_SHA256
    assert material.binding == binding
    assert material.capability == _CAPABILITY
    assert material.root_identity == filesystem.root_identity
    assert material.persisted_binding.root_identity == filesystem.root_identity
    assert material.paths.root.name == f"cybrik-d2-ctl-{_AUTHORIZATION_SHA256[:20]}"
    assert filesystem.opened == [(material.paths.root, True)]
    assert filesystem.reads == ["capability.bin", "binding.json"]


def test_control_material_is_refused_when_the_signed_root_identity_drifts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A record signed for another control root never admits a client."""

    authorization = _authorization()
    binding = harness._control_binding(authorization)  # type: ignore[arg-type]
    filesystem = _FakeControlFileSystem(
        binding=binding,
        signed_root_identity=process_control.RootIdentity(
            device=7,
            inode=99,
            owner_uid=binding.owner_uid,
            mode=stat.S_IFDIR | 0o700,
        ),
    )
    monkeypatch.setattr(
        harness.process_control,
        "PosixFileSystemAdapter",
        lambda: filesystem,
    )

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="stable process authority is unavailable: control_binding_mismatch",
    ):
        harness._load_control(authorization)  # type: ignore[arg-type]


def test_stray_numeric_pid_record_never_authorizes_a_destructive_signal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Stopping is an authenticated control request, never a PID plus ``ps``."""

    (tmp_path / "ai-server.pid").write_text("4321", encoding="ascii")
    requests: list[str] = []

    def forbidden(*args: object, **kwargs: object) -> object:
        raise AssertionError("numeric process authority was exercised")

    monkeypatch.setattr(harness.os, "kill", forbidden)
    monkeypatch.setattr(harness.subprocess, "run", forbidden)
    monkeypatch.setattr(harness.subprocess, "Popen", forbidden)
    monkeypatch.setattr(harness, "assert_runtime_authorized", _authorization)
    monkeypatch.setattr(harness, "assert_product_api_compatibility", lambda _: None)
    monkeypatch.setattr(
        harness.runtime_authorization, "verify_consumed", lambda _: None
    )
    monkeypatch.setattr(
        harness,
        "_load_control",
        lambda _: (
            object(),
            object(),
            SimpleNamespace(stop_all=lambda *, request_id: requests.append(request_id)),
        ),
    )
    monkeypatch.setattr(harness.store, "stop", lambda: requests.append("stop_store"))

    harness.stop()

    assert requests == ["lifecycle-stop-all", "stop_store"]
    assert (tmp_path / "ai-server.pid").read_text(encoding="ascii") == "4321"


def test_stop_refuses_the_store_when_control_authority_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Without an authenticated client no later step may touch the store."""

    stopped: list[str] = []

    def refuse(_authorization: object) -> object:
        raise harness.RuntimeAuthorizationError(
            "stable process authority is unavailable: control_leaf_invalid"
        )

    monkeypatch.setattr(harness, "assert_runtime_authorized", _authorization)
    monkeypatch.setattr(harness, "assert_product_api_compatibility", lambda _: None)
    monkeypatch.setattr(
        harness.runtime_authorization, "verify_consumed", lambda _: None
    )
    monkeypatch.setattr(harness, "_load_control", refuse)
    monkeypatch.setattr(harness.store, "stop", lambda: stopped.append("stop_store"))

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="stable process authority is unavailable",
    ):
        harness.stop()

    assert stopped == []


@pytest.mark.parametrize(
    ("role", "revision"),
    (
        ("soc", "HEAD"),
        ("soc", "HEAD^{tree}"),
        ("cyber_ai", "HEAD"),
        ("cyber_ai", "HEAD^{tree}"),
        ("tool_fabric", "HEAD"),
        ("tool_fabric", "HEAD^{tree}"),
    ),
)
def test_terminal_tuple_rejects_product_identity_drift(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    role: str,
    revision: str,
) -> None:
    """Terminal SOC, AI, and Fabric commits and trees must equal admission."""

    roots = {
        "soc": tmp_path / "soc",
        "cyber_ai": tmp_path / "ai",
        "tool_fabric": tmp_path / "fabric",
    }
    suite_root = tmp_path / "suite"
    suite_head = "d" * 40
    expected = {
        product_role: {
            "HEAD": runtime_auth.PINNED_VALUES[
                {
                    "soc": "SOC_COMMIT",
                    "cyber_ai": "CYBER_AI_COMMIT",
                    "tool_fabric": "TOOL_FABRIC_COMMIT",
                }[product_role]
            ],
            "HEAD^{tree}": runtime_auth.PINNED_VALUES[
                {
                    "soc": "SOC_TREE",
                    "cyber_ai": "CYBER_AI_TREE",
                    "tool_fabric": "TOOL_FABRIC_TREE",
                }[product_role]
            ],
        }
        for product_role in roots
    }

    def git_value(root: Path, requested_revision: str) -> str:
        if root == suite_root:
            return suite_head if requested_revision == "HEAD" else "e" * 40
        product_role = next(
            name for name, product_root in roots.items() if root == product_root
        )
        if product_role == role and requested_revision == revision:
            return "f" * 40
        return expected[product_role][requested_revision]

    monkeypatch.setattr(harness, "_git_value", git_value)
    authorization = SimpleNamespace(
        suite_root=suite_root,
        suite_head=suite_head,
        product_roots=roots,
    )

    with pytest.raises(harness.RuntimeAuthorizationError):
        harness._repository_tuple(authorization)  # type: ignore[arg-type]


def test_terminal_tuple_uses_master_signed_repository_identities(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A master reservation must not fall back to legacy D2 product pins."""

    roots = {
        "suite": tmp_path / "suite",
        "soc": tmp_path / "soc",
        "ai": tmp_path / "ai",
        "fabric": tmp_path / "fabric",
    }
    signed = (
        ("cybrik-soc-command-center", "1" * 40, "2" * 40),
        ("cybrik-cyber-ai-platform", "3" * 40, "4" * 40),
        ("cybrik-security-tool-fabric", "5" * 40, "6" * 40),
        ("cybrik-suite", "7" * 40, "8" * 40),
    )
    observed = {
        roots["soc"]: ("1" * 40, "2" * 40),
        roots["ai"]: ("3" * 40, "4" * 40),
        roots["fabric"]: ("5" * 40, "6" * 40),
        roots["suite"]: ("7" * 40, "8" * 40),
    }

    authorization = object.__new__(runtime_auth.ReservedRuntimeBinding)
    object.__setattr__(authorization, "suite_root", roots["suite"])
    object.__setattr__(authorization, "suite_head", "7" * 40)
    object.__setattr__(
        authorization,
        "product_roots",
        {
            "soc": roots["soc"],
            "cyber_ai": roots["ai"],
            "tool_fabric": roots["fabric"],
        },
    )
    object.__setattr__(authorization, "repository_tuple", signed)

    monkeypatch.setattr(
        harness,
        "_git_value",
        lambda root, revision: observed[root][0 if revision == "HEAD" else 1],
    )

    assert harness._repository_tuple(authorization) == {
        "suite": {"commit_sha": "7" * 40, "tree_sha": "8" * 40},
        "soc": {"commit_sha": "1" * 40, "tree_sha": "2" * 40},
        "ai": {"commit_sha": "3" * 40, "tree_sha": "4" * 40},
        "fabric": {"commit_sha": "5" * 40, "tree_sha": "6" * 40},
    }


@pytest.mark.parametrize(
    ("role", "revision"),
    (
        ("suite", "HEAD"),
        ("suite", "HEAD^{tree}"),
        ("soc", "HEAD"),
        ("soc", "HEAD^{tree}"),
        ("ai", "HEAD"),
        ("ai", "HEAD^{tree}"),
        ("fabric", "HEAD"),
        ("fabric", "HEAD^{tree}"),
    ),
)
def test_terminal_tuple_rejects_master_signed_identity_drift(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    role: str,
    revision: str,
) -> None:
    roots = {
        "suite": tmp_path / "suite",
        "soc": tmp_path / "soc",
        "ai": tmp_path / "ai",
        "fabric": tmp_path / "fabric",
    }
    signed = (
        ("cybrik-soc-command-center", "1" * 40, "2" * 40),
        ("cybrik-cyber-ai-platform", "3" * 40, "4" * 40),
        ("cybrik-security-tool-fabric", "5" * 40, "6" * 40),
        ("cybrik-suite", "7" * 40, "8" * 40),
    )
    observed = {
        roots["soc"]: ("1" * 40, "2" * 40),
        roots["ai"]: ("3" * 40, "4" * 40),
        roots["fabric"]: ("5" * 40, "6" * 40),
        roots["suite"]: ("7" * 40, "8" * 40),
    }
    authorization = object.__new__(runtime_auth.ReservedRuntimeBinding)
    object.__setattr__(authorization, "suite_root", roots["suite"])
    object.__setattr__(authorization, "suite_head", "7" * 40)
    object.__setattr__(
        authorization,
        "product_roots",
        {
            "soc": roots["soc"],
            "cyber_ai": roots["ai"],
            "tool_fabric": roots["fabric"],
        },
    )
    object.__setattr__(authorization, "repository_tuple", signed)

    def git_value(root: Path, requested_revision: str) -> str:
        observed_role = next(name for name, path in roots.items() if path == root)
        if observed_role == role and requested_revision == revision:
            return "9" * 40
        return observed[root][0 if requested_revision == "HEAD" else 1]

    monkeypatch.setattr(harness, "_git_value", git_value)

    with pytest.raises(harness.RuntimeAuthorizationError):
        harness._repository_tuple(authorization)


def test_server_environment_strips_ambient_ssl_key_log_destination(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Child TLS contexts must never inherit an ambient key-log destination."""

    monkeypatch.setenv("SSLKEYLOGFILE", str(tmp_path / "ambient-keylog.txt"))
    monkeypatch.setattr(
        harness,
        "_postgres_runtime",
        lambda root: SimpleNamespace(admin_dsn="postgresql://synthetic"),
    )

    environment = harness._server_environment(
        tmp_path / "cybrik-uat-d2-runtime-unit",
        tmp_path / "cybrik-uat-d2-evidence-unit",
        strip_tls=False,
    )

    assert "SSLKEYLOGFILE" not in environment


def _reserved_child_authority(
    tmp_path: Path,
) -> tuple[runtime_auth.ReservedRuntimeBinding, process_control.ControlMaterial]:
    repositories = tuple(
        (name, tmp_path / name)
        for name in (
            "cybrik-soc-command-center",
            "cybrik-cyber-ai-platform",
            "cybrik-security-tool-fabric",
            "cybrik-suite",
        )
    )
    external = tuple(
        (name, tmp_path / name)
        for name in (
            "postgres_d2_runtime",
            "postgres_d2_evidence",
            "alert_context_runtime",
            "alert_context_evidence",
            "alert_context_state",
        )
    )
    facts = runtime_auth.MasterReservationFacts(
        aggregate_sha256="a" * 64,
        authorization_file=tmp_path / "master-authorization.json",
        authorization_sha256="b" * 64,
        authorization_signature=tmp_path / "master-authorization.sig",
        allowed_signers_file=tmp_path / "allowed-signers",
        external_roots=external,
        external_roots_sha256="c" * 64,
        exact_head_grant_sha256="d" * 64,
        master_evidence_root=tmp_path / "master-evidence",
        marker_sha256="e" * 64,
        postgres_evidence_root=dict(external)["postgres_d2_evidence"],
        postgres_runtime_root=dict(external)["postgres_d2_runtime"],
        repository_roots=repositories,
        repository_roots_sha256="f" * 64,
        repository_tuple=tuple(
            (name, "1" * 40, "2" * 40) for name, _root in repositories
        ),
        repository_tuple_sha256="3" * 64,
        run_id="master-run-1",
    )
    product_roots = {
        "soc": dict(repositories)["cybrik-soc-command-center"],
        "cyber_ai": dict(repositories)["cybrik-cyber-ai-platform"],
        "tool_fabric": dict(repositories)["cybrik-security-tool-fabric"],
    }
    authorization = runtime_auth.ReservedRuntimeBinding(
        authorization_id=facts.run_id,
        suite_root=dict(repositories)["cybrik-suite"],
        suite_head="1" * 40,
        suite_admission_base="1" * 40,
        aggregate_sha256=facts.aggregate_sha256,
        authorization_sha256=facts.authorization_sha256,
        exact_head_grant_sha256=facts.exact_head_grant_sha256,
        external_roots_sha256=facts.external_roots_sha256,
        repository_roots_sha256=facts.repository_roots_sha256,
        runtime_root=facts.postgres_runtime_root,
        evidence_root=facts.postgres_evidence_root,
        product_roots=product_roots,
        repository_tuple=facts.repository_tuple,
        master_reservation=facts,
    )
    binding = process_control.ControlBinding(
        authorization_sha256=facts.authorization_sha256,
        run_id="4" * 32,
        generation=1,
        owner_uid=0,
    )
    identity = process_control.RootIdentity(1, 2, 0, stat.S_IFDIR | 0o700)
    paths = process_control.ControlPaths(
        root=tmp_path / "control",
        socket=tmp_path / "control/s",
        capability=tmp_path / "control/capability.bin",
        binding=tmp_path / "control/binding.json",
        ready=tmp_path / "control/ready.json",
        liveness_lock=tmp_path / "control/liveness.lock",
        shutdown_receipt=tmp_path / "control/shutdown.json",
    )
    material = process_control.ControlMaterial(
        paths=paths,
        binding=binding,
        root_identity=identity,
        capability=b"k" * process_control.CAPABILITY_BYTES,
        persisted_binding=process_control.PersistedControlBinding(binding, identity),
    )
    return authorization, material


def test_reserved_child_environment_carries_only_supervisor_mac_proof(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization, material = _reserved_child_authority(tmp_path)
    monkeypatch.setattr(
        harness,
        "_bound_postgres_runtime",
        lambda _: SimpleNamespace(admin_dsn="postgresql://bound"),
    )
    monkeypatch.setenv(harness._RESERVATION_FRAME_ENV, "ambient-substitution")

    environment = harness._server_environment(
        authorization.runtime_root,
        authorization.evidence_root,
        strip_tls=False,
        authorization=authorization,
        control_material=material,
    )

    frame = harness.base64.b64decode(
        environment[harness._RESERVATION_FRAME_ENV].encode("ascii"), validate=True
    )
    body = process_control.verify_frame(frame, material.capability)
    assert body == {
        "control_binding": material.binding.as_payload(),
        "kind": "master_reservation",
        "reservation": runtime_auth.master_reservation_payload(authorization),
    }
    assert environment[harness._CONTROL_RUN_ID_ENV] == material.binding.run_id
    assert (
        environment[harness._AUTHORIZATION_SHA_ENV]
        == authorization.authorization_sha256
    )


def test_child_mac_proof_verifies_marker_tuple_environment_and_imports(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization, material = _reserved_child_authority(tmp_path)
    events: list[str] = []
    encoded = harness._reservation_frame(authorization, material)
    monkeypatch.setenv(harness._RESERVATION_FRAME_ENV, encoded)
    monkeypatch.setattr(
        harness, "_child_control_material", lambda: (object(), material)
    )
    monkeypatch.setattr(
        runtime_auth,
        "authorize_from_master_reservation",
        lambda facts: events.append("binding") or authorization,
    )
    monkeypatch.setattr(
        runtime_auth,
        "verify_master_consumption",
        lambda facts: events.append("marker"),
    )
    monkeypatch.setattr(
        harness, "_verify_child_environment", lambda _: events.append("environment")
    )
    monkeypatch.setattr(
        harness,
        "_stage_repository_tuple",
        lambda _: {"suite": {"clean": True}},
    )
    monkeypatch.setattr(
        runtime_auth,
        "verify_loaded_module_origins",
        lambda _: events.append("origins"),
    )

    assert harness.assert_child_runtime_authorized() == authorization
    assert events == ["binding", "marker", "environment", "origins"]


def test_child_tampered_mac_fails_before_binding(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization, material = _reserved_child_authority(tmp_path)
    frame = bytearray(
        harness.base64.b64decode(
            harness._reservation_frame(authorization, material).encode("ascii")
        )
    )
    frame[-2] ^= 1
    monkeypatch.setenv(
        harness._RESERVATION_FRAME_ENV,
        harness.base64.b64encode(frame).decode("ascii"),
    )
    monkeypatch.setattr(
        harness, "_child_control_material", lambda: (object(), material)
    )
    monkeypatch.setattr(
        runtime_auth,
        "authorize_from_master_reservation",
        lambda _: (_ for _ in ()).throw(AssertionError("unauthenticated binding used")),
    )

    with pytest.raises(harness.RuntimeAuthorizationError, match="proof is closed"):
        harness.assert_child_runtime_authorized()


def test_child_valid_mac_with_unsigned_reservation_fails_at_sshsig_gate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    authorization, material = _reserved_child_authority(tmp_path)
    monkeypatch.setenv(
        harness._RESERVATION_FRAME_ENV,
        harness._reservation_frame(authorization, material),
    )
    monkeypatch.setattr(
        harness, "_child_control_material", lambda: (object(), material)
    )

    with pytest.raises(harness.RuntimeAuthorizationError, match="proof is closed"):
        harness.assert_child_runtime_authorized()


def test_child_without_reservation_proof_keeps_legacy_exact_authorization(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sentinel = object()
    monkeypatch.delenv(harness._RESERVATION_FRAME_ENV, raising=False)
    monkeypatch.setattr(
        harness.runtime_authorization,
        "authorize_from_environment",
        lambda: sentinel,
    )

    assert harness.assert_child_runtime_authorized() is sentinel


def test_listener_probe_disables_key_logging_on_constructed_tls_context(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The in-process readiness context must clear stdlib ambient key logging."""

    class FakeContext:
        def __init__(self) -> None:
            self.keylog_filename: str | None = str(tmp_path / "ambient-keylog.txt")
            self.minimum_version: object | None = None
            self.maximum_version: object | None = None

        def load_cert_chain(self, certfile: str, keyfile: str) -> None:
            del certfile, keyfile

    context = FakeContext()
    monkeypatch.setattr(
        harness.ssl,
        "create_default_context",
        lambda **kwargs: context,
    )
    exited_process = SimpleNamespace(poll=lambda: 1)

    with pytest.raises(
        harness.RuntimeAuthorizationError,
        match="AI server exited before readiness",
    ):
        harness._wait_ai_listener(tmp_path, exited_process)  # type: ignore[arg-type]

    assert context.keylog_filename is None
    assert not (tmp_path / "ambient-keylog.txt").exists()
