"""Regression contracts for the D2 Docker client trust boundary.

These tests are process-free: they capture the command boundary without
starting Docker or connecting to a daemon.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from cybrik_suite_uat_mtls import store


def _runtime(tmp_path: Path) -> store.PostgresRuntime:
    return store.PostgresRuntime(password="p" * 32, ai_repository=tmp_path)


def test_password_bearing_docker_command_uses_one_absolute_executable_across_paths(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """Ambient PATH must not select the executable that receives credentials."""

    observed_argv: list[tuple[str, ...]] = []

    def capture_run(
        argv: tuple[str, ...], **_kwargs: object
    ) -> SimpleNamespace:
        observed_argv.append(argv)
        return SimpleNamespace(returncode=0, stdout="")

    monkeypatch.setattr(store, "assert_preflight", lambda: None)
    monkeypatch.setattr(store, "wait_ready", lambda _runtime: None)
    monkeypatch.setattr(store, "_run", capture_run)

    for hostile_path in ("/tmp/unreviewed-a:/usr/bin", "/tmp/unreviewed-b:/bin"):
        monkeypatch.setenv("PATH", hostile_path)
        store.start(_runtime(tmp_path))

    executable_tokens = [argv[0] for argv in observed_argv]
    assert len(executable_tokens) == 2
    assert executable_tokens[0] == executable_tokens[1]
    assert Path(executable_tokens[0]).is_absolute(), (
        "credential-bearing Docker calls must consume an authenticated absolute "
        "executable rather than a PATH-resolved program name"
    )


def test_password_bearing_docker_environment_rejects_ambient_client_selection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Daemon selectors and ambient client configuration must fail closed."""

    docker_selectors = {
        "DOCKER_HOST": "tcp://unreviewed.invalid:2376",
        "DOCKER_CONTEXT": "unreviewed-context",
        "DOCKER_CONFIG": "/tmp/unreviewed-docker-config",
        "DOCKER_TLS_VERIFY": "0",
        "DOCKER_CERT_PATH": "/tmp/unreviewed-docker-certs",
        "DOCKER_API_VERSION": "0.0-unreviewed",
        "DOCKER_CUSTOM_HEADERS": "X-Unreviewed=1",
    }
    ambient_client_paths = {
        "PATH": "/tmp/unreviewed-bin:/usr/bin",
        "HOME": "/tmp/unreviewed-home",
        "XDG_CONFIG_HOME": "/tmp/unreviewed-xdg",
    }
    ambient = {**docker_selectors, **ambient_client_paths, "UNRELATED": "sentinel"}
    monkeypatch.setattr(store.os, "environ", ambient)

    environment = store._docker_environment("s" * 32)

    assert not docker_selectors.keys() & environment.keys()
    for name, hostile_value in ambient_client_paths.items():
        assert environment.get(name) != hostile_value
    assert "UNRELATED" not in environment
    assert environment["POSTGRES_PASSWORD"] == "s" * 32
    assert environment["PGPASSWORD"] == "s" * 32
    assert environment["POSTGRES_DB"] == store.POSTGRES_DATABASE
