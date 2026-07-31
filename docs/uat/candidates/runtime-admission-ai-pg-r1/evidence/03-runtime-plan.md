# Runtime Admission AI PG R1 Exact Runtime Plan

Bounded target:
- PostgreSQL 16 only
- loopback bind only: `127.0.0.1:55432`
- container name: `cybrik-ai-pg-uat-r1`
- admin login: `postgres`
- runtime login: `cybrik_ai_runtime_uat`
- shared NOLOGIN group role activated by the adapter: `cybrik_ai_api_app`

Prerequisite env vars:
- `AI_PG_POSTGRES_PASSWORD`
- `AI_PG_RUNTIME_PASSWORD`
- `AI_API_POSTGRES_ADMIN_DSN`
- `AI_API_POSTGRES_RUNTIME_DSN`
- `CYBRIK_AI_REPO`

Exact command plan:

Start:

```bash
docker run --name cybrik-ai-pg-uat-r1 \
  --rm \
  -e POSTGRES_PASSWORD="${AI_PG_POSTGRES_PASSWORD:?}" \
  -p 127.0.0.1:55432:5432 \
  -d postgres:16-alpine
```

```bash
until docker exec cybrik-ai-pg-uat-r1 pg_isready -U postgres -d postgres; do sleep 1; done
```

```bash
export AI_API_POSTGRES_ADMIN_DSN="postgresql+asyncpg://postgres:${AI_PG_POSTGRES_PASSWORD:?}@127.0.0.1:55432/postgres"
export AI_API_POSTGRES_RUNTIME_DSN="postgresql+asyncpg://cybrik_ai_runtime_uat:${AI_PG_RUNTIME_PASSWORD:?}@127.0.0.1:55432/postgres"
```

Reset:

```bash
cd "${CYBRIK_AI_REPO:?}"
uv sync --locked --all-groups
AI_API_POSTGRES_ADMIN_DSN="${AI_API_POSTGRES_ADMIN_DSN:?}" \
uv run python -c "import os; from pathlib import Path; from alembic import command; from alembic.config import Config; root = Path.cwd(); cfg = Config(str(root / 'services' / 'ai-api' / 'migrations' / 'alembic.ini')); cfg.set_main_option('script_location', str(root / 'services' / 'ai-api' / 'migrations')); cfg.set_main_option('sqlalchemy.url', os.environ['AI_API_POSTGRES_ADMIN_DSN']); command.downgrade(cfg, 'base'); command.upgrade(cfg, 'head')"
```

Seed runtime principal after migration:

```bash
docker exec -e PGPASSWORD="${AI_PG_POSTGRES_PASSWORD:?}" cybrik-ai-pg-uat-r1 psql \
  --set=ON_ERROR_STOP=1 \
  --set=runtime_password="${AI_PG_RUNTIME_PASSWORD:?}" \
  -U postgres -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cybrik_ai_runtime_uat') THEN
    CREATE ROLE cybrik_ai_runtime_uat
      LOGIN;
  END IF;
END
$$;
ALTER ROLE cybrik_ai_runtime_uat
  LOGIN
  PASSWORD :'runtime_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;
GRANT cybrik_ai_api_app TO cybrik_ai_runtime_uat;
SQL
```

Post-migration runtime proof:

```bash
cd "${CYBRIK_AI_REPO:?}"
AI_API_POSTGRES_ADMIN_DSN="${AI_API_POSTGRES_ADMIN_DSN:?}" \
AI_API_POSTGRES_RUNTIME_DSN="${AI_API_POSTGRES_RUNTIME_DSN:?}" \
uv run pytest --no-cov tests/ai_api/test_postgres_durable.py -q
```

Optional focused role proof:

```bash
cd "${CYBRIK_AI_REPO:?}"
AI_API_POSTGRES_ADMIN_DSN="${AI_API_POSTGRES_ADMIN_DSN:?}" \
AI_API_POSTGRES_RUNTIME_DSN="${AI_API_POSTGRES_RUNTIME_DSN:?}" \
uv run pytest --no-cov tests/ai_api/test_postgres_durable.py -q -k "runtime_identity or role_is_nobypassrls"
```

Rollback:

```bash
cd "${CYBRIK_AI_REPO:?}"
AI_API_POSTGRES_ADMIN_DSN="${AI_API_POSTGRES_ADMIN_DSN:?}" \
uv run python -c "import os; from pathlib import Path; from alembic import command; from alembic.config import Config; root = Path.cwd(); cfg = Config(str(root / 'services' / 'ai-api' / 'migrations' / 'alembic.ini')); cfg.set_main_option('script_location', str(root / 'services' / 'ai-api' / 'migrations')); cfg.set_main_option('sqlalchemy.url', os.environ['AI_API_POSTGRES_ADMIN_DSN']); command.downgrade(cfg, 'base')"
```

Stop:

```bash
docker stop cybrik-ai-pg-uat-r1
```

Notes:
- The Alembic override is required because `services/ai-api/migrations/alembic.ini` hardcodes `sqlalchemy.url = postgresql+asyncpg://localhost/postgres`.
- `--no-cov` is deliberate for this single-file runtime proof: repository-wide coverage remains
  enforced by the full hosted `test` job, while this command's pass/fail signal is reserved for
  the PostgreSQL migration, role, RLS, tenant-isolation, durability, and concurrency assertions.
  At Cyber AI commit `97a82b8e9e4788a1d588858f0eac1ca104a9236b`, root `pyproject.toml`
  directly declares `pytest-cov>=5.0.0` and configures
  `--cov --cov-branch --cov-fail-under=60`; `uv run pytest --help` exposes `--no-cov`.
- The downgrade intentionally removes schema-local objects only; the shared role `cybrik_ai_api_app` remains.
- `cybrik_ai_runtime_uat` stays `NOINHERIT`; the proof relies on explicit `SET LOCAL ROLE cybrik_ai_api_app`.
- No HTTP socket, web app, or full-stack demo is part of this authorized proof.
