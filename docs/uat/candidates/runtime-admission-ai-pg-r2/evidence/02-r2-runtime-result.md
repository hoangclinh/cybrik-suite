# Runtime Admission AI PG R2 Result

Recorded at `2026-07-31T05:36:26Z`.

## Exact admitted inputs

- Canonical Suite admission merge: `fd2cb8ffe7f3ee366e8b18bbb88d247cb2062388`, tree
  `9e49f23f32e5c8052848ceea80a146df069795c9`, post-merge hosted run
  `30607073062` success.
- Product tuple retained from the R2 authorization record:
  - Suite source: `0ec429a8280d6ca2ad85833f8983b4123e4a3e60`, tree
    `51ea95b966fb09a446bed41b6736cf3bf37cd4a5`.
  - SOC: `9d42a6dc3f9f5a25de75a79a887bafae74498152`, tree
    `16ef74d6f97cbf90a504bb3cee57a98712e40c56`.
  - Cyber AI: `b55d1db3a55a2524707330cee2eaf6f78342cddd`, tree
    `b45620e6be501f37341e87a346d4d2ba518bf394`.
  - Tool Fabric: `49583be00235a0f8ad7da8cb4ea99108ad201a69`, tree
    `ca8b4a03116bea979de89b92b2f8fef4fd31e001`.
- Docker client/server: `29.6.2`.
- PostgreSQL image:
  `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`.
- PostgreSQL server: `16.14`.
- Network bind: `127.0.0.1:55432`.
- Test data and credentials: generated synthetic values only; no credential material is retained.

## Attempt accounting

The R2 runtime invocation consumed its one authorized attempt. The four recorded lifecycle
checkpoints are:

1. exact tuple, clean worktree, absent container, and closed-listener preflight: **PASS**;
2. PostgreSQL container start and readiness: **PASS**;
3. locked dependency sync plus Alembic downgrade-to-base/upgrade-to-head: **PASS**;
4. restricted runtime-principal seed using the exact admitted command: **FAIL**.

Counts: **4 executed, 3 passed, 1 failed**.

The required command
`uv run pytest --no-cov tests/ai_api/test_postgres_durable.py -q` was **NOT RUN** because the
preceding seed checkpoint failed. No test result is inferred.

## Failing behavior

The admitted seed procedure successfully executed its role-existence `DO` block, then PostgreSQL
rejected the following `ALTER ROLE` statement:

```text
ALTER ROLE cybrik_ai_runtime_uat LOGIN PASSWORD :'runtime_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
```

Observed error:

```text
ERROR:  syntax error at or near ":"
LINE 1: ALTER ROLE cybrik_ai_runtime_uat LOGIN PASSWORD :'runtime_pa...
                                                        ^
```

The `psql --set=runtime_password=... -c "ALTER ROLE ... :'runtime_password' ..."` form in the
canonical R2 lifecycle procedure did not substitute the variable in this `-c` statement. This is
an admitted-command defect. It is not evidence of a Cyber AI persistence failure because the
runtime test suite never began.

## Containment

- container `cybrik-ai-pg-uat-r2` removed: **PASS**;
- listener on `127.0.0.1:55432` closed: **PASS**;
- generated credentials removed from the invoking process environment: **PASS**;
- no HTTP service or full stack was started;
- no production credentials, configuration, data, or traffic were used.

## Disposition

- Candidate R2 is **NO-GO**.
- The `runtime-admission-ai-pg` series has consumed both admitted ordinals and authorizes no
  further execution.
- The failed command must not be corrected and rerun out of band. Any recovery requires a
  separately reviewed correction and a new, explicitly admitted candidate boundary that cannot
  erase or reinterpret R1/R2 history.
- No Cyber AI PostgreSQL runtime proof, UAT, demo, POC, RC, GA, public release, or production
  readiness claim follows.
