from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Self

import pytest
from cybrik_suite_uat_fabric import runtime_wiring_process
from cybrik_suite_uat_fabric.runtime_supervisor import SupervisorBinding


class _Response:
    def __init__(self, status_code: int, document: object) -> None:
        self.status_code = status_code
        self._document = document

    def json(self) -> object:
        return self._document


def _config(tmp_path: Path) -> object:
    suite = tmp_path / "suite"
    harness = suite / "integration/compose/soc-ai-fabric-alert-context-mtls/src"
    lifecycle = suite / "integration/compose/soc-ai-lifecycle-create-mtls/src"
    soc = tmp_path / "soc/services/api/src"
    ai_api = tmp_path / "ai/services/ai-api/src"
    ai_core = tmp_path / "ai/packages/ai-core/src"
    fabric = tmp_path / "fabric/src/control-plane"
    for path in (harness, lifecycle, soc, ai_api, ai_core, fabric):
        path.mkdir(parents=True)
    python = tmp_path / "python"
    python.write_bytes(b"python")
    return SimpleNamespace(
        python=python,
        repositories=SimpleNamespace(
            suite=suite,
            soc_source=soc,
            cyber_ai_api_source=ai_api,
            cyber_ai_core_source=ai_core,
            tool_fabric_source=fabric,
        ),
    )


def test_child_startup_is_safe_exact_and_includes_lifecycle_b1_source(
    tmp_path: Path,
) -> None:
    config = _config(tmp_path)
    runtime_config = tmp_path / "runtime-config.json"
    environment = runtime_wiring_process.build_child_environment(config, runtime_config)

    assert runtime_wiring_process.build_child_argv(config, "fabric") == (
        str(config.python),
        "-B",
        "-P",
        "-m",
        "cybrik_suite_uat_fabric.runtime_process",
        "fabric",
    )
    assert environment == {
        "CYBRIK_UAT_RUNTIME_CONFIG": str(runtime_config),
        "LC_ALL": "C",
        "PATH": "/usr/bin:/bin",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONPATH": ":".join(
            (
                str(
                    config.repositories.suite
                    / "integration/compose/soc-ai-fabric-alert-context-mtls/src"
                ),
                str(
                    config.repositories.suite
                    / "integration/compose/soc-ai-lifecycle-create-mtls/src"
                ),
                str(config.repositories.soc_source),
                str(config.repositories.cyber_ai_api_source),
                str(config.repositories.cyber_ai_core_source),
                str(config.repositories.tool_fabric_source),
            )
        ),
        "PYTHONSAFEPATH": "1",
    }
    assert not ({"HOME", "SSLKEYLOGFILE", "HTTP_PROXY"} & set(environment))


def test_reserved_cleanup_removes_owned_contents_but_preserves_bound_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from cybrik_suite_uat_fabric import runtime_pki
    from cybrik_suite_uat_fabric.runtime_cleanup import runtime_root_clean

    root = tmp_path / "reserved-runtime"
    root.mkdir(mode=0o700)
    (root / "private.pem").write_bytes(b"private")
    (root / "logs").mkdir()
    (root / "logs/process.log").write_text("log", encoding="utf-8")
    events: list[str] = []
    monkeypatch.setattr(
        runtime_pki,
        "destroy_runtime_pki",
        lambda _pki: events.append("destroy-pki"),
    )
    context = SimpleNamespace(
        closers=[lambda: events.append("close")],
        pki=object(),
        config=SimpleNamespace(external=SimpleNamespace(runtime_root=root.resolve())),
    )

    runtime_wiring_process._remove_runtime_root(context, preserve_root=True)

    assert root.is_dir()
    assert list(root.iterdir()) == []
    assert runtime_root_clean(root, preserve_root=True) is True
    assert events == ["close", "destroy-pki"]


def test_standalone_cleanup_removes_root_and_invalid_mode_fails_before_effect(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from cybrik_suite_uat_fabric import runtime_pki
    from cybrik_suite_uat_fabric.runtime_cleanup import runtime_root_clean

    events: list[str] = []
    monkeypatch.setattr(
        runtime_pki,
        "destroy_runtime_pki",
        lambda _pki: events.append("destroy-pki"),
    )

    def context(root: Path) -> object:
        return SimpleNamespace(
            closers=[lambda: events.append("close")],
            pki=object(),
            config=SimpleNamespace(external=SimpleNamespace(runtime_root=root)),
        )

    removable = tmp_path / "standalone-runtime"
    removable.mkdir(mode=0o700)
    runtime_wiring_process._remove_runtime_root(context(removable.resolve()))
    assert not removable.exists()
    assert runtime_root_clean(removable, preserve_root=False) is True
    assert events == ["close", "destroy-pki"]

    invalid = tmp_path / "invalid-runtime"
    invalid.mkdir(mode=0o755)
    assert runtime_root_clean(invalid, preserve_root=True) is False
    with pytest.raises(
        runtime_wiring_process.RuntimeAdmissionWiringError,
        match="runtime_cleanup_failed",
    ):
        runtime_wiring_process._remove_runtime_root(
            context(invalid.resolve()), preserve_root=True
        )
    assert events == ["close", "destroy-pki"]


@pytest.mark.parametrize("role", ("", "driver", "SOC"))
def test_child_argv_rejects_every_non_process_role(tmp_path: Path, role: str) -> None:
    with pytest.raises(
        runtime_wiring_process.RuntimeWiringProcessError,
        match="process_role_invalid",
    ):
        runtime_wiring_process.build_child_argv(_config(tmp_path), role)


@pytest.mark.parametrize(
    ("role", "response"),
    (
        ("soc", _Response(200, {"soc_calls": 0})),
        ("ai", _Response(200, {"model_calls": 0})),
        (
            "fabric",
            _Response(
                404,
                {
                    "error": {
                        "code": "RECEIPT_UNAVAILABLE",
                        "retryable": False,
                    },
                    "status": "unavailable",
                },
            ),
        ),
    ),
)
def test_readiness_accepts_only_exact_authenticated_role_response(
    role: str, response: _Response
) -> None:
    runtime_wiring_process.validate_readiness_response(role, response)


@pytest.mark.parametrize(
    "response",
    (
        _Response(403, {"detail": "Forbidden"}),
        _Response(404, {"detail": "Not Found"}),
        _Response(
            404,
            {
                "error": {
                    "code": "RECEIPT_UNAVAILABLE",
                    "retryable": True,
                },
                "status": "unavailable",
            },
        ),
    ),
)
def test_fabric_readiness_never_accepts_403_or_a_non_route_body(
    response: _Response,
) -> None:
    with pytest.raises(
        runtime_wiring_process.RuntimeWiringProcessError,
        match="readiness_response_invalid",
    ):
        runtime_wiring_process.validate_readiness_response("fabric", response)


@pytest.mark.parametrize(
    ("role", "response"),
    (
        ("soc", _Response(200, {"soc_calls": False})),
        ("ai", _Response(200, {"model_calls": -1})),
        ("unknown", _Response(200, {})),
    ),
)
def test_metrics_readiness_is_strict(role: str, response: _Response) -> None:
    with pytest.raises(
        runtime_wiring_process.RuntimeWiringProcessError,
        match="readiness_response_invalid",
    ):
        runtime_wiring_process.validate_readiness_response(role, response)


class _Supervisor:
    def __init__(self) -> None:
        self.owned_roles: tuple[str, ...] = ()
        self.calls: list[tuple[str, str, bytes, int]] = []

    def start_role(self, role: str, frame: bytes, *, peer_uid: int) -> bytes:
        self.calls.append(("start", role, frame, peer_uid))
        self.owned_roles = (*self.owned_roles, role)
        return b"start_" + role.encode()

    def stop_role(self, role: str, frame: bytes, *, peer_uid: int) -> bytes:
        self.calls.append(("stop", role, frame, peer_uid))
        self.owned_roles = tuple(item for item in self.owned_roles if item != role)
        return b"stop_" + role.encode()


def _binding() -> SupervisorBinding:
    return SupervisorBinding(
        authorization_sha256="a" * 64,
        source_tuple_sha256="b" * 64,
        run_id="run-1",
        owner_uid=0,
    )


def test_authenticated_controller_dispatches_only_framed_role_actions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from cybrik_suite_uat_fabric import runtime_supervisor

    monkeypatch.setattr(
        runtime_supervisor,
        "encode_request",
        lambda **values: values["action"].encode(),
    )
    monkeypatch.setattr(
        runtime_supervisor,
        "decode_response",
        lambda response, **_values: {"action": response.decode()},
    )
    supervisor = _Supervisor()
    controller = runtime_wiring_process.AuthenticatedSupervisorController(
        supervisor=supervisor,
        binding=_binding(),
        capability=b"c" * 32,
    )

    controller.start_role("soc")
    assert controller.owned_roles == ("soc",)
    controller.stop_role("soc")

    assert [call[:3] for call in supervisor.calls] == [
        ("start", "soc", b"start_soc"),
        ("stop", "soc", b"stop_soc"),
    ]


def test_authenticated_controller_refuses_bad_binding_interface_and_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from cybrik_suite_uat_fabric import runtime_supervisor

    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        runtime_wiring_process.AuthenticatedSupervisorController(
            supervisor=object(), binding=object(), capability=b"x"
        )
    monkeypatch.setattr(
        runtime_supervisor, "encode_request", lambda **_values: b"frame"
    )
    monkeypatch.setattr(
        runtime_supervisor, "decode_response", lambda *_args, **_kwargs: {}
    )
    controller = runtime_wiring_process.AuthenticatedSupervisorController(
        supervisor=object(), binding=_binding(), capability=b"c" * 32
    )
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        controller.start_role("soc")
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        _ = controller.owned_roles

    supervisor = _Supervisor()
    controller = runtime_wiring_process.AuthenticatedSupervisorController(
        supervisor=supervisor, binding=_binding(), capability=b"c" * 32
    )
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        controller.start_role("soc")


class _DirectSupervisor:
    def __init__(self) -> None:
        self.owned_roles: tuple[str, ...] = ()
        self.events: list[str] = []

    def start_role(self, role: str) -> None:
        self.events.append("start:" + role)
        self.owned_roles = (*self.owned_roles, role)

    def stop_role(self, role: str) -> None:
        self.events.append("stop:" + role)
        self.owned_roles = tuple(item for item in self.owned_roles if item != role)


def test_runtime_session_order_finalization_and_refusal_branches() -> None:
    supervisor = _DirectSupervisor()
    events: list[str] = []
    context = object()
    session = runtime_wiring_process.RuntimeSession(
        supervisor=supervisor,
        cleanup=lambda: events.append("cleanup"),
        absence_probe=lambda: {"absent": True},
        runtime_context=context,
    )
    assert session.runtime_context is context
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        session.start("ai")
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        session.verify_absent()
    soc = session.start("soc")
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        session.wait_ready(object())  # type: ignore[arg-type]
    supervisor.owned_roles = ()
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        session.wait_ready(soc)
    supervisor.owned_roles = ("soc",)
    session.wait_ready(soc)
    fabric = session.start("fabric")
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        session.stop(soc)
    session.stop(fabric)
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        session.stop(fabric)
    session.finalize()
    session.finalize()
    assert session.verify_absent() == {"absent": True}
    assert events == ["cleanup"]


def test_runtime_session_refuses_a_fourth_start() -> None:
    supervisor = _DirectSupervisor()
    session = runtime_wiring_process.RuntimeSession(
        supervisor=supervisor, cleanup=lambda: None, absence_probe=dict
    )
    for role in ("soc", "fabric", "ai"):
        session.start(role)
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        session.start("soc")
    session.finalize()


def test_secure_receipt_input_and_root_validation(tmp_path: Path) -> None:
    root = tmp_path / "receipts"
    root.mkdir(mode=0o700)
    filesystem = runtime_wiring_process.SecureReceiptFileSystem(root)
    for name, payload in (("../x", b"x"), ("", b"x"), ("x", "not-bytes")):
        with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
            filesystem.write_once(name, payload)  # type: ignore[arg-type]
    wrong = tmp_path / "wrong"
    wrong.mkdir(mode=0o755)
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        runtime_wiring_process.SecureReceiptFileSystem(wrong)


class _Process:
    pid = 42

    def __init__(self) -> None:
        self.events: list[object] = []

    def poll(self) -> int | None:
        return None

    def terminate(self) -> None:
        self.events.append("terminate")

    def wait(self, timeout: float) -> int:
        self.events.append(("wait", timeout))
        return 0

    def kill(self) -> None:
        self.events.append("kill")


def test_owned_child_delegates_lifecycle_and_closes_log() -> None:
    process = _Process()
    log = SimpleNamespace(close=lambda: process.events.append("close"))
    child = runtime_wiring_process._OwnedChild(process, log)
    assert child.pid == 42
    assert child.poll() is None
    child.terminate()
    assert child.wait(1.5) == 0
    child.kill()
    assert process.events == ["terminate", ("wait", 1.5), "close", "kill"]


class _Connection:
    def __init__(self, chunks: list[bytes]) -> None:
        self.chunks = chunks
        self.sent = b""

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def settimeout(self, _timeout: float) -> None:
        return None

    def sendall(self, payload: bytes) -> None:
        self.sent += payload

    def recv(self, _size: int) -> bytes:
        return self.chunks.pop(0) if self.chunks else b""


class _TlsContext:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def wrap_socket(self, _raw: object, *, server_hostname: str) -> _Connection:
        assert server_hostname == "uat.example"
        return self.connection


def _client(connection: _Connection) -> runtime_wiring_process.PinnedHttpsClient:
    client = runtime_wiring_process.PinnedHttpsClient.__new__(
        runtime_wiring_process.PinnedHttpsClient
    )
    client._port = 58444
    client._server_name = "uat.example"
    client._context = _TlsContext(connection)
    return client


def test_pinned_client_serializes_get_and_post_without_external_network(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"ok":true}'
    connection = _Connection([response, b""])
    monkeypatch.setattr(
        runtime_wiring_process.socket,
        "create_connection",
        lambda *_a, **_k: _Connection([]),
    )
    client = _client(connection)

    assert client.get("/ready").json() == {"ok": True}
    assert b"GET /ready HTTP/1.1" in connection.sent
    response2 = b'HTTP/1.1 202 OK\r\n\r\n{"accepted":true}'
    connection2 = _Connection([response2, b""])
    client._context = _TlsContext(connection2)
    assert (
        client.post("/invoke", json={"b": 2}, headers={"X-A": "1"}).status_code == 202
    )
    assert b'{"b":2}' in connection2.sent
    assert client.close() is None


def test_pinned_client_refuses_bad_requests_transport_and_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client(_Connection([]))
    for method, path, values in (
        ("DELETE", "/x", {}),
        ("GET", "relative", {}),
        ("GET", "/x", {"headers": []}),
        ("POST", "/x", {"json": {1, 2}}),
    ):
        with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
            client._request(method, path, **values)
    monkeypatch.setattr(
        runtime_wiring_process.socket,
        "create_connection",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError()),
    )
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        client.get("/x")
    monkeypatch.setattr(
        runtime_wiring_process.socket,
        "create_connection",
        lambda *_a, **_k: _Connection([]),
    )
    for payload in (
        b"bad",
        b"HTTP/1.1 nope OK\r\n\r\n{}",
        b"HTTP/1.1 200 OK\r\n\r\nnot-json",
    ):
        client._context = _TlsContext(_Connection([payload, b""]))
        with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
            client.get("/x")


def test_private_filesystem_and_document_helpers(tmp_path: Path) -> None:
    created = runtime_wiring_process._mkdir(tmp_path / "created")
    private = created / "private"
    runtime_wiring_process._write_private(private, b"secret")
    assert private.read_bytes() == b"secret"
    assert runtime_wiring_process.HttpResponse(200, [1]).json() == [1]
    material = SimpleNamespace(
        client_certificate=Path("cert"),
        client_private_key=Path("key"),
        ca_certificate=Path("ca"),
    )
    assert runtime_wiring_process._client_document(material) == {
        "certificate": "cert",
        "private_key": "key",
        "ca_certificate": "ca",
    }
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        runtime_wiring_process._mkdir(created)
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        runtime_wiring_process._write_private(private, b"again")


def test_child_environment_and_readiness_error_edges(tmp_path: Path) -> None:
    config = _config(tmp_path)
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        runtime_wiring_process.build_child_environment(config, Path("relative"))
    missing = config.repositories.soc_source
    missing.rmdir()
    with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
        runtime_wiring_process.build_child_environment(config, tmp_path / "config")

    class _RaisingResponse:
        status_code = 404

        def json(self) -> object:
            raise ValueError

    for response in (SimpleNamespace(status_code=404), _RaisingResponse()):
        with pytest.raises(runtime_wiring_process.RuntimeWiringProcessError):
            runtime_wiring_process.validate_readiness_response("fabric", response)
