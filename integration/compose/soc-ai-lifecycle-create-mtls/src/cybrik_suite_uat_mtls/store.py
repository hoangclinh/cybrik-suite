"""Digest-pinned disposable PostgreSQL controller for one authorized D2 run.

Status: ``AUTHORED — NOT RUN``. No command is executed at import time. Every
subprocess receives argv directly with ``shell=False``; database credentials
live only in child environments and are never rendered into evidence.
"""

from __future__ import annotations

import os
import re
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Final

POSTGRES_IMAGE: Final = (
    "postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777"
)
CONTAINER_NAME: Final = "cybrik-suite-uat-mtls-d2-r1"
POSTGRES_HOST: Final = "127.0.0.1"
POSTGRES_PORT: Final = 55432
POSTGRES_DATABASE: Final = "cybrik_uat_mtls_d2"
POSTGRES_USER: Final = "postgres"
RUNTIME_ROLE: Final = "cybrik_ai_api_app"
RLS_TABLE_COUNT: Final = 5
_TENANT_RE: Final = re.compile(r"^[0-9a-f-]{36}$")


class PostgresBoundaryError(RuntimeError):
    """A bounded PostgreSQL lifecycle action failed closed."""


@dataclass(frozen=True, slots=True)
class PostgresRuntime:
    password: str
    ai_repository: Path

    @property
    def admin_dsn(self) -> str:
        return (
            f"postgresql+asyncpg://{POSTGRES_USER}:{self.password}@"
            f"{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DATABASE}"
        )

    @property
    def secret_free_identity(self) -> dict[str, object]:
        return {
            "container_id": CONTAINER_NAME,
            "database_id": POSTGRES_DATABASE,
            "host": POSTGRES_HOST,
            "image_id": POSTGRES_IMAGE,
            "port": POSTGRES_PORT,
            "runtime_role_id": RUNTIME_ROLE,
        }


def _run(
    argv: tuple[str, ...],
    *,
    environment: dict[str, str] | None = None,
    check: bool = True,
    timeout: float = 60.0,
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            argv,
            check=check,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=environment,
            shell=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise PostgresBoundaryError("bounded PostgreSQL command failed") from exc


def _docker_environment(password: str) -> dict[str, str]:
    if len(password) < 32:
        raise PostgresBoundaryError("ephemeral PostgreSQL credential is invalid")
    environment = dict(os.environ)
    environment["POSTGRES_PASSWORD"] = password
    environment["PGPASSWORD"] = password
    environment["POSTGRES_DB"] = POSTGRES_DATABASE
    return environment


def container_exists() -> bool:
    # `docker container inspect` is deliberately the existence authority.
    result = _run(
        ("docker", "container", "inspect", CONTAINER_NAME),
        check=False,
        timeout=15,
    )
    return result.returncode == 0


def assert_preflight() -> None:
    if container_exists():
        raise PostgresBoundaryError("bounded PostgreSQL container already exists")
    image = _run(
        ("docker", "image", "inspect", POSTGRES_IMAGE), check=False, timeout=15
    )
    if image.returncode != 0:
        raise PostgresBoundaryError("digest-pinned PostgreSQL image is absent")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.25)
        if probe.connect_ex((POSTGRES_HOST, POSTGRES_PORT)) == 0:
            raise PostgresBoundaryError("bounded PostgreSQL port is already in use")


def start(runtime: PostgresRuntime) -> None:
    assert_preflight()
    argv = (
        "docker",
        "run",
        "--pull=never",
        "--name",
        CONTAINER_NAME,
        "--rm",
        "-e",
        "POSTGRES_PASSWORD",
        "-e",
        "PGPASSWORD",
        "-e",
        "POSTGRES_DB",
        "-p",
        f"{POSTGRES_HOST}:{POSTGRES_PORT}:5432",
        "-d",
        POSTGRES_IMAGE,
    )
    _run(argv, environment=_docker_environment(runtime.password), timeout=90)
    try:
        wait_ready(runtime)
    except BaseException:
        stop()
        raise


def wait_ready(runtime: PostgresRuntime, *, attempts: int = 60) -> None:
    environment = _docker_environment(runtime.password)
    for _ in range(attempts):
        ready = _run(
            (
                "docker",
                "exec",
                "-e",
                "PGPASSWORD",
                CONTAINER_NAME,
                "pg_isready",
                "-U",
                POSTGRES_USER,
                "-d",
                POSTGRES_DATABASE,
            ),
            environment=environment,
            check=False,
            timeout=5,
        )
        if ready.returncode == 0:
            try:
                with socket.create_connection(
                    (POSTGRES_HOST, POSTGRES_PORT), timeout=0.25
                ):
                    return
            except OSError:
                pass
        time.sleep(0.25)
    raise PostgresBoundaryError("bounded PostgreSQL readiness timed out")


def migrate(runtime: PostgresRuntime, revision: str = "head") -> None:
    repository = runtime.ai_repository.resolve(strict=True)
    migration_root = repository / "services/ai-api/migrations"
    config_path = migration_root / "alembic.ini"
    if not config_path.is_file():
        raise PostgresBoundaryError("pinned Cyber AI migration configuration is absent")
    try:
        from alembic import command
        from alembic.config import Config

        config = Config(str(config_path))
        config.set_main_option("script_location", str(migration_root))
        config.set_main_option("sqlalchemy.url", runtime.admin_dsn)
        command.upgrade(config, revision)
    except Exception as exc:
        raise PostgresBoundaryError("bounded PostgreSQL migration failed") from exc


def _psql(runtime: PostgresRuntime, sql: str, *, timeout: float = 30.0) -> str:
    completed = _run(
        (
            "docker",
            "exec",
            "-e",
            "PGPASSWORD",
            CONTAINER_NAME,
            "psql",
            "-X",
            "-A",
            "-t",
            "-q",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            POSTGRES_USER,
            "-d",
            POSTGRES_DATABASE,
            "-c",
            sql,
        ),
        environment=_docker_environment(runtime.password),
        timeout=timeout,
    )
    return completed.stdout.strip()


def audit_security_posture(runtime: PostgresRuntime) -> dict[str, object]:
    """Prove the migration-created role posture plus FORCE RLS and isolation."""

    role = _psql(
        runtime,
        "SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles "
        "WHERE rolname = 'cybrik_ai_api_app';",
    )
    if role != "f|f|f":
        raise PostgresBoundaryError("runtime PostgreSQL role posture is unsafe")
    force_rls_count = _psql(
        runtime,
        "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = 'ai_orchestration' "
        "AND c.relname IN ('runs','effects','outbox','delegation_replay','checkpoint_documents') "
        "AND c.relrowsecurity AND c.relforcerowsecurity;",
    )
    if force_rls_count != str(RLS_TABLE_COUNT):
        raise PostgresBoundaryError(
            "runtime PostgreSQL FORCE RLS posture is incomplete"
        )

    isolation = _psql(
        runtime,
        "BEGIN; "
        "INSERT INTO ai_orchestration.delegation_replay "
        "(tenant_id, jti_hash, expires_at) VALUES "
        "('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', repeat('b', 64), 4102444800) "
        "ON CONFLICT DO NOTHING; "
        "SET LOCAL ROLE cybrik_ai_api_app; "
        "WITH configured AS ("
        "SELECT set_config('app.tenant_id', "
        "'11111111-2222-4333-8444-555555555555', true)"
        ") SELECT count(*) FROM ai_orchestration.delegation_replay, configured "
        "WHERE tenant_id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'; "
        "ROLLBACK;",
    )
    if isolation != "0":
        raise PostgresBoundaryError("runtime PostgreSQL RLS isolation probe failed")
    return {
        "postgres_force_rls_table_count": RLS_TABLE_COUNT,
        "postgres_role_posture_verified": True,
        "postgres_rls_isolation_verified": True,
    }


def replay_row_count(runtime: PostgresRuntime, *, tenant_id: str) -> int:
    """Return the durable replay rows for one strictly validated synthetic tenant."""

    if _TENANT_RE.fullmatch(tenant_id) is None:
        raise PostgresBoundaryError("runtime replay tenant identifier is invalid")
    raw = _psql(
        runtime,
        "SELECT count(*) FROM ai_orchestration.delegation_replay "
        f"WHERE tenant_id = '{tenant_id}';",
    )
    if not raw.isdecimal():
        raise PostgresBoundaryError("runtime replay count is invalid")
    return int(raw)


def stop() -> None:
    if not container_exists():
        return
    _run(("docker", "rm", "-f", CONTAINER_NAME), check=False, timeout=60)


def verify_absent() -> bool:
    if container_exists():
        return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.25)
        return probe.connect_ex((POSTGRES_HOST, POSTGRES_PORT)) != 0


def python_executable() -> str:
    return str(Path(sys.executable).resolve(strict=True))
