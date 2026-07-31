# Runtime Admission AI PG R3 Result

Recorded at `2026-07-31T08:43:29Z`.

## Exact admitted inputs

- Canonical Suite authorization merge: `189ddf9ff7ad090d3877dd9fed8b3fe315cc81a8`,
  tree `6d45b36ea58dc8f4300fc4eef419f3dfe8d14081`.
- Canonical Suite post-merge hosted run: `30616921613`, with `contract standards validation`
  and `secret-scan` successful.
- Product tuple retained from the R3 authorization record:
  - Suite source: `c0ef0d3a41d10dbdd885fc38f9f1fc0db967b5bd`, tree
    `b59af36b2dfea496b6745ed446573732e1b92751`.
  - SOC: `9d42a6dc3f9f5a25de75a79a887bafae74498152`, tree
    `16ef74d6f97cbf90a504bb3cee57a98712e40c56`.
  - Cyber AI: `14d5919e1d80eac6fc22287a69a9476cac2b77a4`, tree
    `b45620e6be501f37341e87a346d4d2ba518bf394`.
  - Tool Fabric: `49583be00235a0f8ad7da8cb4ea99108ad201a69`, tree
    `ca8b4a03116bea979de89b92b2f8fef4fd31e001`.
- PostgreSQL image:
  `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`.
- Network bind: `127.0.0.1:55432`.
- Test data and credentials: fresh generated synthetic values only; no credential material is
  retained.

## Attempt accounting

The one reviewed R3 recovery invocation was executed once and is consumed. Six recorded
checkpoints are:

1. canonical authorization gate, exact Cyber AI tuple, clean worktree, absent container and closed
   listener preflight: **PASS**;
2. PostgreSQL container start plus container-side and host-side TCP readiness: **PASS**;
3. locked dependency sync plus Alembic downgrade-to-base/upgrade-to-head: **PASS**;
4. restricted runtime-principal seed through one stdin-fed `psql` transaction: **PASS**;
5. exact admitted pytest command completed with `25 passed in 1.59s` and no skipped tests:
   **PASS**;
6. authorization-artifact acceptance check requiring the report to say literal `13 passed`:
   **FAIL** because the exact admitted command runs the whole file and truthfully reported
   `25 passed`.

Counts: **6 executed, 5 passed, 1 failed**.

## Observed test-cardinality mismatch

The exact command was:

```text
AI_API_POSTGRES_ADMIN_DSN="${AI_API_POSTGRES_ADMIN_DSN:?}" AI_API_POSTGRES_RUNTIME_DSN="${AI_API_POSTGRES_RUNTIME_DSN:?}" uv run pytest --no-cov tests/ai_api/test_postgres_durable.py -q
```

Observed output:

```text
.........................                                                [100%]
25 passed in 1.59s
```

Read-only inspection after containment found `25` test functions in the exact pinned file and `13`
`@pytest.mark.integration` decorators. The command selects the entire file, not only integration
markers. Therefore `25 passed` is the expected truthful total for these bytes and includes the 13
integration-marked tests; it cannot satisfy the authorization artifact's later, overly narrow
literal `13 passed` condition.

This is an acceptance-specification defect introduced while hardening the pre-run authorization,
not an observed PostgreSQL, RLS, tenant-isolation or restricted-role failure. The raw PostgreSQL
test outcome remains recorded, but it is not reinterpreted as a passing admission after the exact
condition failed.

## Containment

- Alembic rollback to base after the test command: **PASS**;
- container `cybrik-ai-pg-uat-r3` removed: **PASS**;
- listener on `127.0.0.1:55432` closed: **PASS**;
- generated credentials removed from the invoking process environment: **PASS**;
- pinned Cyber AI worktree has no tracked or untracked diff after the attempt: **PASS**;
- no HTTP service, outbox worker or full stack was started;
- no production credentials, configuration, data or traffic were used.

## Disposition

- Candidate R3 is **NO-GO** because its exact acceptance condition did not match the truthful test
  report.
- The same-series recovery ordinal is consumed. No retry, corrected command, substituted selector
  or out-of-band invocation is authorized.
- R1 and R2 remain immutable `NO-GO` records.
- This result records real bounded PostgreSQL evidence but grants no `DEMO_READY_LOCAL`, UAT, demo,
  POC, RC, GA, public release or production readiness claim.
- Any future runtime work requires a new, separately reviewed admission design that preserves all
  three terminal results and does not reinterpret this invocation.
