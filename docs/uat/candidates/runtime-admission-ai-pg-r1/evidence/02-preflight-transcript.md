# Runtime Admission AI PG R1 Preflight

Recorded at `2026-07-31T03:29:56Z`.

Scope:
- This is a static preflight only.
- No Docker container, PostgreSQL instance, or HTTP service was started in this candidate turn.
- The requested authorization target is one bounded loopback Cyber AI PostgreSQL 16 proof only.

Contained prior attempt:
- The first loopback attempt used the now-superseded Cyber AI commit
  `8da372b6a2a9468c58ebfc2c3359c8409b8a7c86` and stopped before migration because
  the async SQLAlchemy runtime dependency `greenlet` was not installed on macOS arm64.
- The failure path removed container `cybrik-ai-pg-uat-r1`; the loopback port was confirmed closed,
  and no PostgreSQL runtime, RLS, tenant-isolation, UAT, or release claim was made.
- Cyber AI commit `97a82b8e9e4788a1d588858f0eac1ca104a9236b` closes the dependency explicitly
  in the package manifest and lock, passes 831 no-DB tests with the 13 PostgreSQL integration
  tests still explicitly skipped, and has all eight required hosted checks green in run
  `30601517961`.
- This refreshed record authorizes one bounded retry at that exact commit/tree tuple.

Preflight smoke labels:
- `tenant_isolation_static_preflight_pass`: reviewed the durable-slice migration and adapter source for `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, per-table tenant policies, and transaction-local `SET LOCAL ROLE cybrik_ai_api_app` plus `set_config('app.tenant_id', ...)`; also reviewed the authored 13 PostgreSQL integration negatives in `tests/ai_api/test_postgres_durable.py`. This is not runtime proof.
- `authorization_static_preflight_pass`: reviewed the four no-DB guard tests that already pass without a live PostgreSQL instance:
  - `test_runtime_role_name_rejects_reserved_and_invalid_identifiers`
  - `test_blank_tenant_is_rejected_before_any_db_call`
  - `test_whitespace_only_tenant_is_rejected_before_any_db_call`
  - `test_malformed_row_decode_is_wrapped_as_durable_execution_unavailable`
- `secret_boundary_static_preflight_pass`: hosted `secret-scan` checks are green for Suite, SOC, Cyber AI, and Fabric; this candidate directory records only env-var names and synthetic DSN templates, never live credentials.

Static source facts reviewed:
- `services/ai-api/migrations/versions/0001_ai_durable_postgres_slice.py`
- `services/ai-api/src/cybrik_ai_api/orchestration/postgres.py`
- `tests/ai_api/test_postgres_durable.py`
- `docs/operations/AI-DURABLE-POSTGRES-SLICE.md`
- `../cybrik-worktrees/w3-48/suite-runtime-admission-ai-pg-r1/tools/contract-validation/validate-runtime-admission.mjs`

Residual honesty:
- The 13 PostgreSQL integration tests were not executed in this candidate turn.
- This preflight authorizes only a future loopback PostgreSQL 16 proof at `127.0.0.1:55432`.
- It does not certify HTTP ingress, outbox workers, demo, UAT, POC, RC, or GA.
