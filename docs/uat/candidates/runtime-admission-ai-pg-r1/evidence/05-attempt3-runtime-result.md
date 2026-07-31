# Runtime Admission AI PG R1 Attempt 3 Result

Recorded at `2026-07-31T04:14:04Z`.

Exact admitted inputs:
- Suite admission commit: `0ec429a8280d6ca2ad85833f8983b4123e4a3e60`
- Suite post-merge contracts run: `30603481779` — success
- Cyber AI commit: `48309201c84543ece44c81a5967865ef6c17f784`
- Cyber AI tree: `baadaacc15e24d19baf3b3383afa05a6851e20f0`
- PostgreSQL: `16.14`
- Network bind: `127.0.0.1:55432`
- Test data and credentials: generated synthetic values only; no credential material is retained

Phases:
- clean exact-head preflight: PASS
- loopback port preflight: PASS
- locked dependency sync: PASS
- Alembic downgrade-to-base plus upgrade-to-head: PASS
- distinct runtime principal seed with `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`,
  `NOINHERIT`, and `NOBYPASSRLS`: PASS
- `uv run pytest --no-cov tests/ai_api/test_postgres_durable.py -q`:
  **18 passed, 1 failed**

Failing behavior:
- Test: `test_advance_and_stage_rolls_back_if_outbox_insert_fails`
- PostgreSQL raised a unique violation for constraint `outbox_pkey`.
- SQLAlchemy/asyncpg surfaced the error as an `IntegrityError`.
- The adapter did not classify that integrity error as a durable conflict and instead raised
  `DurableExecutionUnavailable`.
- The expected product behavior is `DurableAdvanceStatus.conflict` with the enclosing transaction
  rolled back.

Containment:
- container `cybrik-ai-pg-uat-r1` removed: PASS
- listener on `127.0.0.1:55432` closed: PASS
- no HTTP service or full stack was started
- no production credentials, configuration, data, or traffic were used

Disposition:
- Candidate R1 is **NO-GO**.
- No UAT, demo, POC, RC, GA, or production readiness claim follows.
- A new candidate must use schema-enforced attempt accounting and a new exact Cyber AI tuple after
  the conflict-classification defect is fixed and independently reviewed.
