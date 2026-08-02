"""RED contracts for D2 harness process, provenance, and TLS boundaries.

These tests are deliberately synthetic.  They do not inspect or signal a real
process, open a TLS socket, execute Git, or start any Suite runtime component.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_mtls import harness
from cybrik_suite_uat_mtls import runtime_authorization as runtime_auth


def test_recorded_process_inspection_uses_fixed_executable_and_sanitized_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Recovery inspection must not resolve ``ps`` or config from ambient state."""

    pid_path = tmp_path / "ai-server.pid"
    pid_path.write_text("4321", encoding="ascii")
    observed: dict[str, object] = {}
    monkeypatch.setenv("PATH", str(tmp_path / "untrusted-bin"))
    monkeypatch.setenv("PYTHONPATH", str(tmp_path / "untrusted-python"))
    monkeypatch.setenv("LD_PRELOAD", str(tmp_path / "untrusted-loader"))

    def inspect(argv: tuple[str, ...], **kwargs: object) -> SimpleNamespace:
        observed["argv"] = argv
        observed["env"] = kwargs.get("env")
        return SimpleNamespace(returncode=1, stdout="")

    monkeypatch.setattr(harness.subprocess, "run", inspect)

    harness._stop_recorded_process(
        tmp_path,
        pid_filename=pid_path.name,
        identity="cybrik_suite_uat_mtls.server",
    )

    argv = observed["argv"]
    assert isinstance(argv, tuple)
    assert argv[0] == "/bin/ps"
    environment = observed["env"]
    assert isinstance(environment, dict)
    assert environment["PATH"] == "/usr/bin:/bin"
    assert environment["LC_ALL"] == "C"
    assert set(environment) <= {"LANG", "LC_ALL", "PATH"}
    assert {"PYTHONPATH", "LD_PRELOAD"}.isdisjoint(environment)


def test_numeric_pid_record_alone_never_authorizes_destructive_signal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A reusable PID plus matching command text is not a stable process handle."""

    pid_path = tmp_path / "ai-server.pid"
    pid_path.write_text("4321", encoding="ascii")
    signals: list[tuple[int, int]] = []
    monkeypatch.setattr(
        harness.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(
            returncode=0,
            stdout="python -m cybrik_suite_uat_mtls.server\n",
        ),
    )

    def record_signal(pid: int, value: int) -> None:
        signals.append((pid, value))
        if value == 0:
            raise ProcessLookupError

    monkeypatch.setattr(harness.os, "kill", record_signal)

    with pytest.raises(harness.RuntimeAuthorizationError):
        harness._stop_recorded_process(
            tmp_path,
            pid_filename=pid_path.name,
            identity="cybrik_suite_uat_mtls.server",
        )

    assert signals == []
    assert pid_path.is_file()


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
