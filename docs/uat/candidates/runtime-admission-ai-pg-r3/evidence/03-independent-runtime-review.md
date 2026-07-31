# Independent Runtime Authorization Review — AI PG R3

## Reviewer and exact scope

Reviewer/model/date: **Claude Opus via 1DevTool, 2026-07-31.**

Independent, read-only review of exactly one bounded non-production PostgreSQL runtime attempt for `runtime-admission-ai-pg-r3`. No file was edited, no Git write performed, no Docker/`psql`/container/credential/runtime/network action taken, no production system touched. All conclusions derive from direct reads of end-state files in the two named worktrees.

This review authorizes nothing by itself and asserts no runtime success. No PostgreSQL instance was started and no lifecycle step was executed as part of it.

## Exact pins reviewed

| Item | Value |
|---|---|
| Suite worktree | `w3-48/suite-runtime-admission-ai-pg-evidence-r1` |
| Suite canonical commit/tree (stated) | `c0ef0d3a41d10dbdd885fc38f9f1fc0db967b5bd` / `b59af36b2dfea496b6745ed446573732e1b92751` |
| Suite post-merge run (stated) | `30615019067` success; contract standards validation + full-history secret-scan success |
| Suite tuple **pinned inside the R3 record** | commit `6278920d162c6ec30320699aa11c6fff9e00ad34`, tree `e75286a9ee00de72d2571ee05a9fe11953e515c8`, run `30609391186` |
| Cyber AI worktree | `w3-48/ai-pg-runtime-exact-14d5919` (detached, exact) |
| Cyber AI commit/tree | `14d5919e1d80eac6fc22287a69a9476cac2b77a4` / `b45620e6be501f37341e87a346d4d2ba518bf394`, run `30607775111` success / 8 required |
| SOC | `9d42a6dc…` / `16ef74d6…`, run `30598693305` success / 8 required — unchanged |
| Tool Fabric | `49583be0…` / `ca8b4a03…`, run `30591694272` success / 3 required — unchanged |
| PostgreSQL image | `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777` |
| R3 candidate SHA (asserted) | `a7461f6a82c237c96b215935ef31e259499eba3581fd7f59b0153560532259ab` |
| Correction evidence SHA (asserted) | `054254d1fb9b2e474d3942d273e875d0d92e143fd8a47d391380ce2e007162cb` |
| Parsed seed SHA / bytes (asserted) | `ac8a4bf2ef6cf7810b40f7c00713478f313708a4b45bdb6b89cfac4a8f7b8632` / 537 |

Non-required jobs remain excluded and documented unchanged: SOC `e2e-org`, SOC `alert-context-route-db` (suppressed, `if:false` in workflow source), Fabric `executor` (skipped) — `runtime-admission.json:198-219`.

## Verification performed

Each admission condition was checked against the exact end-state bytes.

| Condition | Result | Evidence |
|---|---|---|
| One non-interactive zsh session | Confirmed — `ZSH_VERSION` guard, `whence -w printf` must be `printf: builtin`, exit 75 | `runtime-admission.json:268` |
| `set -euo pipefail` | Confirmed, first lifecycle entry | `runtime-admission.json:266` |
| 64-lowerhex synthetic credentials | Confirmed for both variables — `case … *[!0-9a-f]*` plus `${#…} -ne 64`, exit 64 | `runtime-admission.json:267` |
| Clean exact AI commit/tree | Confirmed — `rev-parse HEAD` = `14d5919…`, `HEAD^{tree}` = `b45620e6…`, `status --porcelain --untracked-files=all` empty, exit 76 | `runtime-admission.json:268` |
| Image pre-exists and `--pull=never` | Confirmed — `docker image inspect <digest>` exit 74 before start; `--pull=never` on run | `runtime-admission.json:268`, `:271` |
| Stale resources rejected | Confirmed — existing `cybrik-ai-pg-uat-r3` container and occupied `127.0.0.1:55432` both exit 73 | `runtime-admission.json:268` |
| Trap before export | Confirmed — trap is entry 4 (`:269`), first credential export is entry 5 (`:270`), container start entry 6 (`:271`) | `runtime-admission.json:269-271` |
| Loopback only | Confirmed — `-p 127.0.0.1:55432:5432`; `network_exposure.mode` = `local_only` | `runtime-admission.json:271`, `:349-357` |
| Internal + host-side bounded readiness | Confirmed — in-container `pg_isready -h 127.0.0.1 -p 5432` bounded at 60 (exit 70); host-side `python3` socket probe to `127.0.0.1:55432` bounded at 60 (exit 71). Container TCP is unavailable during the image's init phase, so this ordering avoids a false-ready race | `runtime-admission.json:272-273` |
| Reset creates restricted app role / FORCE RLS | Confirmed — `alembic downgrade base` then `upgrade head`; migration creates `cybrik_ai_api_app` `NOLOGIN NOBYPASSRLS` and **raises** if a preexisting same-name role is `SUPERUSER` or `BYPASSRLS`; all three tables `ENABLE` + `FORCE ROW LEVEL SECURITY` with fail-closed `current_setting('app.tenant_id', true)` policies | `runtime-admission.json:286`; `0001_ai_durable_postgres_slice.py:25-45`, `:131-141` |
| Seed: one stdin `psql`, explicit `BEGIN`/`COMMIT`, `ON_ERROR_STOP` | Confirmed — single brace group piped to `docker exec -i … psql --set=ON_ERROR_STOP=1`; in-stream `\set` + `BEGIN;`/`COMMIT;`. No `-c`/`--command`/`-f`/`--file`/`--single-transaction` appears anywhere in the lifecycle | `runtime-admission.json:289` |
| Login role NOSUPERUSER/NOBYPASSRLS/NOINHERIT, one grant | Confirmed — `ALTER ROLE cybrik_ai_runtime_uat LOGIN PASSWORD :'runtime_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;` and exactly one `GRANT cybrik_ai_api_app TO cybrik_ai_runtime_uat;` | `runtime-admission.json:289` |
| Adapter `SET LOCAL ROLE` + transaction-local tenant context | Confirmed — `SET LOCAL ROLE "<validated>"` then `set_config('app.tenant_id', :tenant_id, true)` inside every `engine.begin()` transaction; role name is regex-validated and reserved-name-blocked before interpolation | `postgres.py:375-383`, `:39-46`, `:465-470` |
| Locked sync | Confirmed — `uv sync --locked --all-groups` | `runtime-admission.json:285` |
| Exact PostgreSQL test file | Confirmed — `uv run pytest --no-cov tests/ai_api/test_postgres_durable.py -q`; 13 `@pytest.mark.integration` tests; `addopts` carries no `-m "not integration"` deselection, so they are collected | `runtime-admission.json:291`; `pyproject.toml:77-85` |
| Idempotent cleanup | Confirmed — `docker rm -f … \|\| true`, credential `unset`, `trap -`; container also `--rm`. `.venv/`, `.pytest_cache/`, `__pycache__/`, `.coverage` are gitignored, so `uv sync`/`pytest` cannot dirty the pinned worktree | `runtime-admission.json:278-282`; `.gitignore:36-49` |
| No retry | Confirmed — `max_attempts` 2 + exactly one `additional_attempts`; ordinal ceiling enforced at `max_attempts + 1`; correction states failure stops the lifecycle with no out-of-band retry | `runtime-admission.json:6-7`, `:18`; `validate-runtime-admission.mjs:455-462`; `01-command-correction.md:77` |

Gate mechanism independently verified as real, not declarative: the validator hard-fails `execution_authorized === true` unless `review_status === 'independently_reviewed_go'` (`validate-runtime-admission.mjs:464-468`); `independently_reviewed_go` requires a review artifact **distinct** from the correction evidence, digest-pinned and listed in `evidence.artifacts` (`:496-518`); artifact digests are verified by re-hashing the actual bytes, with symlink and path-traversal rejection (`:382-427`); every required check must be `success` and must point at the exact candidate tuple SHA (`:645-654`); `RUNTIME_AUTHORIZED` is derivable only from `status: not_run` with `execution_authorized: true` and zero critical/high findings (`:727-729`, `:768-779`).

**Not verified (sandbox denied, not a finding against the artifact):** `git rev-parse`/`status` execution and SHA-256 computation were both blocked. I therefore did **not** independently confirm the R3 candidate SHA, the correction evidence SHA, the parsed seed SHA/bytes (537), or live worktree HEAD/tree/cleanliness. I confirmed both `.git` pointers resolve to the expected parent repositories and worktree names.

## Findings

No **P0** and no **P1** findings.

**P2 — `lifecycle_procedures` key order is not execution order; literal top-down execution destroys the run.**
`runtime-admission.json:265` (`start`), `:278` (`stop`), `:283` (`reset`), `:288` (`seed`), `:293` (`rollback`). An operator executing the object in serialized key order would run `stop` — `docker rm -f` plus credential `unset` — immediately after `start`, before `reset` ever runs. The authoritative order (`start → reset → seed → test → rollback → stop`) exists only in evidence prose at `01-command-correction.md:63-64`, not in the record the operator executes. Not a validator failure; the validator only checks each procedure is non-empty (`validate-runtime-admission.mjs:689-700`).

**P2 — the record pins a suite tuple that is no longer canonical.**
`runtime-admission.json:52-55` and required suite rows `:71-82` pin suite commit `6278920d…` / tree `e75286a9…`, corroborated at `01-command-correction.md:99-100` with run `30609391186`. The authorization request names canonical suite commit `c0ef0d3a…` / tree `b59af36b…` with post-merge run `30615019067`. The validator requires required-check SHAs to equal `commit_tree` SHAs (`validate-runtime-admission.mjs:650`) but never requires either to equal current `HEAD`, so a stale suite tuple validates cleanly while describing a suite state that is not the one execution would occur under. Partly structural — a record cannot pin the commit that contains it — so the correct resolution is re-pinning to the immediate parent canonical commit in the enabling update.

**P3 — the restricted *login* role's attributes are never asserted at runtime.**
`runtime-admission.json:289` sets `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS` on `cybrik_ai_runtime_uat`, but `test_role_is_nobypassrls` asserts only the group role `cybrik_ai_api_app` (`test_postgres_durable.py:521-529`), and `test_runtime_identity_is_distinct_from_admin_and_not_superuser` checks `session_user != current_user` without asserting the session role's `rolsuper`/`rolbypassrls` (`:535-553`). Impact is bounded: PostgreSQL evaluates `BYPASSRLS` against `current_user`, which is `cybrik_ai_api_app` after `SET LOCAL ROLE` (`postgres.py:377`), and the migration hard-rejects a superuser/bypassrls app role (`0001_ai_durable_postgres_slice.py:39-41`). `NOINHERIT` is unverified defense-in-depth.

**P3 — an all-skipped pytest run exits 0 and reads as a pass.**
`test_postgres_durable.py:337-348` calls `pytest.skip` when either DSN is unset, so a seed step whose 13 integration tests all skipped would still exit 0. Mitigated by the `${AI_API_POSTGRES_ADMIN_DSN:?}` / `${AI_API_POSTGRES_RUNTIME_DSN:?}` guards on the pytest command line (`runtime-admission.json:291`), which abort on unset *or empty*. The residual gap is observational, not mechanical.

**P3 — pinned operations doc correctly states no PostgreSQL proof exists and must not be edited.**
`AI-DURABLE-POSTGRES-SLICE.md:31-33` states the 13 integration tests were skipped and no real PostgreSQL/RLS proof exists. That is accurate at the pinned tree and must remain so; the Cyber AI tree is immutable at `14d5919…` and any edit would break the `start` preflight at `runtime-admission.json:268`.

## Verdict

**GO — ONE BOUNDED NON-PRODUCTION R3 POSTGRESQL ATTEMPT ONLY**

The corrected seed resolves the R2 defect at its actual root cause: one standard-input stream through one `psql` process, so `\set runtime_password` is parsed and `:'runtime_password'` interpolated client-side before any statement reaches PostgreSQL, with explicit `BEGIN;`/`COMMIT;` and `--set=ON_ERROR_STOP=1` providing atomic failure containment. Credential handling keeps the synthetic runtime value out of `docker exec` and `psql` argv and forwards the admin value by name. Preflight, containment, isolation, least-privilege and cleanup properties are correctly ordered and internally consistent. The `NOINHERIT` login role paired with adapter-side `SET LOCAL ROLE` plus transaction-local `app.tenant_id` under `FORCE ROW LEVEL SECURITY` is a sound fail-closed design. No P0 or P1 issue was found.

This verdict takes effect **only** after a separate Suite update stores this artifact **verbatim**, pins its SHA-256, sets `review_status: independently_reviewed_go` with `review_evidence_path`/`review_evidence_sha256` listed in `evidence.artifacts` and distinct from the correction evidence, sets `execution_authorized: true` with `status: not_run` and zero counts, and passes both local and hosted required gates. Until that update merges green, execution remains unauthorized.

## Residual limitations and execution conditions

Limitations of this review:

1. I could not execute `git` or compute SHA-256 (sandbox denied both). The R3 candidate SHA `a7461f6a…`, correction SHA `054254d1…`, parsed seed SHA `ac8a4bf2…` / 537 bytes, and worktree HEAD/tree/cleanliness are **unconfirmed by me** and must be re-verified by the enabling update's local and hosted gates, which do re-hash bytes (`validate-runtime-admission.mjs:424-427`).
2. Every conclusion is static. No container, `psql` process, migration, or test ran. **No runtime success is claimed or implied.**
3. `uv sync --locked --all-groups` flag compatibility with the installed `uv` is not statically verifiable.
4. Attempt accounting constrains records, not out-of-band shell invocations.

Conditions binding the authorized attempt:

5. Execute in exactly this order in **one** zsh session: `start` → `reset` → `seed` (SQL) → the pytest command → `rollback` → `stop`. State this order explicitly in the enabling update to close the P2 ordering gap. Never execute `lifecycle_procedures` in serialized key order.
6. Re-pin `commit_tree.suite` and the suite required-check rows to the canonical suite commit/tree and its green post-merge run in the enabling update, closing the P2 staleness gap.
7. **One attempt only. No retry** — not manual, not out-of-band, not a re-run of any step. Any failure terminates the lifecycle through the containment trap; the outcome is recorded as-is and this authorization is spent.
8. Confirm the pytest run reports 13 integration tests **executed**, not skipped. An all-skipped exit 0 is not proof and must be recorded as such.
9. Synthetic 64-lowerhex credentials only. No production credentials, configuration, data, or traffic. Loopback `127.0.0.1:55432` only.
10. **Forbidden:** any retry; HTTP socket or full-stack bring-up; outbox worker dispatch; UAT, demo, POC, RC, GA, public release, or production claim of any kind. Record only what the single attempt actually produced.
