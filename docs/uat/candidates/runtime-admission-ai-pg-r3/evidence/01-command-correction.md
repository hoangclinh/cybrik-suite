# Runtime Admission AI PG R3 Command Correction

Recorded at `2026-07-31T06:24:20Z`.

## Classification and immutable history

This is a prospective correction for the exact command defect recorded by
`runtime-admission-ai-pg-r2`. It does not reinterpret or erase either prior result:

- R1 remains `NO-GO`, with 19 checks executed, 18 passed and 1 failed.
- R2 remains `NO-GO`, with 4 checkpoints executed, 3 passed and 1 failed.
- R2 terminal evidence remains
  `docs/uat/candidates/runtime-admission-ai-pg-r2/evidence/02-r2-runtime-result.md`,
  SHA-256 `c8f4f4bcdf7e31329e46f73de1db1463034de4416c60b46125b18cd2479f2ef7`.

The correction is eligible only for the one same-series recovery ordinal enforced by
`docs/uat/runtime-admission.schema.json` and
`tools/contract-validation/validate-runtime-admission.mjs` at canonical Suite commit
`6278920d162c6ec30320699aa11c6fff9e00ad34`, tree
`e75286a9ee00de72d2571ee05a9fe11953e515c8`.

## Observed root cause

R1's executed runtime plan supplied the SQL through `psql` standard input and recorded the seed
step as passing. Its JSON lifecycle record flattened that multi-line procedure into separate
`psql -c` arguments. R2 then admitted the flattened JSON command as the exact executable command:
PostgreSQL accepted the role-existence block, received the literal token `:'runtime_password'` in
the `ALTER ROLE` statement and returned a syntax error. The PostgreSQL test command did not run.
The defect was therefore a procedure-transcription drift that changed psql variable-interpolation
semantics, not a failure of the R1 standard-input procedure.

PostgreSQL 16 documents that `psql` reads commands from standard input when no `-c` or `-f` source
is selected, and that `:'name'` interpolates a set psql variable as a safely quoted SQL literal:
<https://www.postgresql.org/docs/16/app-psql.html>.

## Exact corrected seed command

The correction keeps the reviewed role, privileges, synthetic environment-variable inputs and
SQL semantics unchanged. Relative to R2, it restores one standard-input stream, makes the already
observed PostgreSQL image digest explicit with `--pull=never`, adds 64-hex credential preflight,
forwards admin credentials by environment-variable name rather than value-bearing argv, rejects a
stale same-name container or occupied loopback port before arming cleanup, adds bounded TCP
readiness plus failure containment, unsets all credential variables on stop, and renames
the one disposable container for R3. It also replaces R2's command-line `--set=runtime_password`
assignment with an unexecuted in-stream `\set runtime_password` meta-command. All three SQL
statements run between explicit in-stream `BEGIN;` and `COMMIT;` commands through one
`psql` process, so psql parses and interpolates `:'runtime_password'` before sending the statement
to PostgreSQL. The image digest is the same
`postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`
recorded for the R2 PostgreSQL 16.14 execution; this prevents tag drift and network pulls.

```bash
{ printf '%s %s\n' '\set runtime_password' "${AI_PG_RUNTIME_PASSWORD:?}"; printf '%s\n' "BEGIN;" "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cybrik_ai_runtime_uat') THEN CREATE ROLE cybrik_ai_runtime_uat LOGIN; END IF; END \$\$;" "ALTER ROLE cybrik_ai_runtime_uat LOGIN PASSWORD :'runtime_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;" "GRANT cybrik_ai_api_app TO cybrik_ai_runtime_uat;" "COMMIT;"; } | docker exec -i cybrik-ai-pg-uat-r3 psql --set=ON_ERROR_STOP=1 -U postgres -d postgres
```

The lifecycle requires both `AI_PG_POSTGRES_PASSWORD` and `AI_PG_RUNTIME_PASSWORD` to be exactly
64 lowercase hexadecimal characters before building either DSN or running this command. Execution
requires a shell whose `printf` is a builtin; the fixed `%s %s\n` format writes the synthetic
runtime value only to the psql input stream, so the value is not placed in
`docker exec` or `psql` process arguments. The admin password is inherited by the container
through named environment forwarding (`-e POSTGRES_PASSWORD -e PGPASSWORD`) rather than a
value-bearing command-line argument. Both values remain synthetic and are unset during
containment. The lifecycle must execute from `start` through `reset`, `seed`, the test command,
`rollback` and `stop` in that exact order inside one zsh session. `set -euo pipefail` and an
`EXIT`/`INT`/`TERM` trap force failure containment; `docker rm -f` removes either a running or
partially created R3 container and the trap unsets every credential-bearing variable.

Required invariants:

1. Explicit in-stream `BEGIN;`/`COMMIT;` and `--set=ON_ERROR_STOP=1` remain enabled; psql's
   `--single-transaction` flag is forbidden because the corrected source is stdin rather than
   `-c`/`-f`.
2. The SQL stream contains the same role-existence, `ALTER ROLE` and grant operations as R2.
3. The role remains `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`.
4. Only generated synthetic passwords may populate the two named environment variables.
5. The command must run only inside the exact admitted R3 lifecycle, once.
6. A failure stops the lifecycle; no manual correction or out-of-band retry is permitted.
7. `psql -c`, `psql --command`, `psql -f` and `psql --file`, including attached short-flag forms,
   are forbidden in the corrected seed.
8. The exact container name and loopback port must be unused before start; Docker and `lsof` must
   be available, and the exact image digest must already exist locally.
9. PostgreSQL readiness probes TCP at `127.0.0.1:5432` inside the container and is bounded to 60
   failed checks; a second bounded probe confirms host-side `127.0.0.1:55432` reachability before
   reset, and either timeout exits through the containment trap.
10. All lifecycle entries execute in one zsh session with builtin `printf`; per-command shells are
    forbidden.
11. `CYBRIK_AI_REPO` must be clean at exact commit
    `14d5919e1d80eac6fc22287a69a9476cac2b77a4`, tree
    `b45620e6be501f37341e87a346d4d2ba518bf394`, before any container starts.

## Static verification and limitation

- The canonical recovery validator has a positive reviewed-recovery authorization case and
  negative cases for pending review, terminal-evidence rebinding, correction/review digest drift,
  multiple added attempts, multiple recovery overrides and any later recovery ordinal.
- Local results for these exact candidate bytes: runtime-admission `36/36`, accepted W1 contracts
  `98/98`, W1 control `222/222`, aggregate validation pass, dependency audit zero vulnerabilities.
- Exact hosted facts refreshed before writing R3:
  - Suite commit `6278920d162c6ec30320699aa11c6fff9e00ad34`, tree
    `e75286a9ee00de72d2571ee05a9fe11953e515c8`, run `30609391186` success.
  - SOC commit `9d42a6dc3f9f5a25de75a79a887bafae74498152`, tree
    `16ef74d6f97cbf90a504bb3cee57a98712e40c56`, run `30598693305` success.
  - Cyber AI commit `14d5919e1d80eac6fc22287a69a9476cac2b77a4`, tree
    `b45620e6be501f37341e87a346d4d2ba518bf394`, run `30607775111` success.
  - Tool Fabric commit `49583be00235a0f8ad7da8cb4ea99108ad201a69`, tree
    `ca8b4a03116bea979de89b92b2f8fef4fd31e001`, run `30591694272` success.
- Rendered branch-protection required-check names were refreshed by GET-only `gh api`; every
  required row in the R3 record matches those hosted facts. The SOC `e2e-org` and
  `alert-context-route-db` jobs and Fabric `executor` job remain excluded from required rows.
- No PostgreSQL container or `psql` process was started to prepare this correction.
- The corrected seed command is therefore a reviewed design candidate, not runtime proof.
- Independent Claude Opus review of the recovery-boundary implementation timed out at 600 seconds
  with exit code 124 and no verdict. The command correction itself remains `pending` independent
  review and authorizes no execution.
