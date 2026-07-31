# Runtime Admission AI PG R2 Authorization

Recorded at `2026-07-31T04:49:14Z`.

## Exact candidate tuple

- Suite: commit `0ec429a8280d6ca2ad85833f8983b4123e4a3e60`, tree
  `51ea95b966fb09a446bed41b6736cf3bf37cd4a5`, hosted run `30603481779` success.
- SOC: commit `9d42a6dc3f9f5a25de75a79a887bafae74498152`, tree
  `16ef74d6f97cbf90a504bb3cee57a98712e40c56`.
- Cyber AI: commit `b55d1db3a55a2524707330cee2eaf6f78342cddd`, tree
  `b45620e6be501f37341e87a346d4d2ba518bf394`, hosted run `30604944689` success
  with all eight rendered required jobs green.
- Tool Fabric: commit `49583be00235a0f8ad7da8cb4ea99108ad201a69`, tree
  `ca8b4a03116bea979de89b92b2f8fef4fd31e001`.

## Prior failed candidate

R1 is retired `NO-GO`. Its final PostgreSQL 16.14 attempt executed 19 checks: 18 passed and one
failed because an `outbox_pkey` unique violation was classified as storage unavailable rather than
a durable conflict. The exact result is recorded at
`docs/uat/candidates/runtime-admission-ai-pg-r1/evidence/05-attempt3-runtime-result.md` with SHA-256
`52742f66e08766810e049a36b8c5dbdbac89dba33a43dc6825a00479fe491b6c`.

## Repair evidence

- TDD reproducer commits precede the production fix.
- The classifier now requires SQLSTATE `23505`, accepts only the existing three-constraint
  allowlist, walks only the translated exception's explicit `__cause__` chain, ignores non-string
  metadata, is cycle-safe, and fails closed after 16 unique nodes.
- The no-database suite uses the installed asyncpg and SQLAlchemy exception classes in addition to
  positive, negative, malformed-metadata, traversal-budget, and suppressed-context cases.
- Local verification at the exact Cyber AI candidate: strict mypy, Ruff lint, Ruff format,
  six focused classifier tests, 838 full-suite passes with 13 explicit PostgreSQL skips,
  94.78% total coverage, and all-package wheel build passed.
- Independent Opus review returned `GO` with no P0/P1 or merge blocker.

## Bounded authority

R2 authorizes exactly one future non-production loopback PostgreSQL 16 proof at
`127.0.0.1:55432`, using generated synthetic credentials and data. The proof must use the exact
candidate tuple and the recorded lifecycle commands. It must execute
`uv run pytest --no-cov tests/ai_api/test_postgres_durable.py -q`, record the exact result, remove
the container, and prove the loopback listener is closed.

`attempt_accounting` limits admission-candidate revisions and requires R2 to retain R1's exact
failed-candidate record. It does not observe commands executed outside the evidence process. The
operational authority in this packet permits one R2 runtime invocation only; an unrecorded repeat
would be a policy and evidence breach rather than a machine-observed attempt.

This authorization does not start PostgreSQL, an HTTP service, or the full stack. It grants no
demo, UAT, POC, RC, GA, production, or public-release claim.
