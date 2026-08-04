# G-U2B PostgreSQL RED runtime grant R1

Status: `ACTIVE R1.3 — STRUCTURED ADMISSION GO — ONE POSTGRESQL RED SELECTOR AUTHORIZED`.

Prepared: `2026-08-04T13:44:19+07:00`.

Activated: `2026-08-04T15:03:12+07:00` by the delegated technical Governor.

Release dates: unchanged. Runtime demo and UAT: `HOLD`. Production: Founder only.

## 1. Decision requested

Authorize one bounded, disposable, non-production PostgreSQL RED observation for the accepted
G-U2B durable replay contract. This record does not authorize GREEN implementation, a migration
edit, a full integration run, UAT, demo, merge, release, or production activity.

No database connection or container start is authorized while this record remains `PROPOSED` or
while the paired `runtime-admission.json` disposition is `HOLD`.
Execution may open only after an independent review returns `GO` with no P0-P2 and the delegated
Governor records the exact active decision in this file and in the paired structured admission.

Authority basis:

- `docs/operations/DELEGATED-GOVERNOR-AUTHORITY-2026-07-30.md` delegates technical decisions;
- `docs/operations/DELEGATED-GOVERNOR-RUNTIME-UAT-RECONCILIATION-2026-07-31.md` permits bounded
  non-production runtime evidence before the stable-v1.0 date only after its technical admission
  gate passes; and
- `G-U2B-CONTRACT-ACCEPTANCE.md` requires a separate database-runtime grant before any migration
  or adapter implementation.

R1.3 activates only the exact Section 3 attempt after the former singleton authority was closed by
the signed append-only withdrawal committed at Suite `4937542fcdd3f871607df6fd3b2625082cc06be1`
(tree `4be22a9b55598121bc93a7cbf2857379c09f856b`). The push and pull-request workflows
`30890312010` and `30890315811` both completed successfully on that exact SHA; each rendered
`contract standards validation` and `secret-scan` as success. Independent exact-byte review of the
withdrawal event returned `GO`, P0/P1/P2/P3 = `0/0/0/0`. This activation does not reinterpret the
withdrawal as runtime evidence and does not broaden any execution step below.

## 2. Exact immutable input

### Suite control record

| Fact | Exact value |
|---|---|
| Suite commit | `4937542fcdd3f871607df6fd3b2625082cc06be1` |
| Suite tree | `4be22a9b55598121bc93a7cbf2857379c09f856b` |
| Accepted contract | `G-U2B-CONTRACT-ACCEPTANCE.md`, R1.1 |
| Accepted SOC proposal commit | `3e1e84db1d94961a026d485cbea2a29a795851a7` |

### SOC RED checkpoint

| Fact | Exact value |
|---|---|
| Repository | `cybrik-soc-command-center` |
| Branch | `codex/uat-browser-g-u2b-red-r1` |
| Commit | `5e13e50f8e988acdd211b5293fdbccb3a40072ec` |
| Parent | `0936f3ea5f2d05ae423bfcbdaa1252594b4c7557` |
| Tree | `373ea72c03dcdbfed19449f8f91e3989eef7122b` |
| Subject | `test: quarantine G-U1 RED contract in CI` |
| G-U2B quarantine anchor | `0936f3ea5f2d05ae423bfcbdaa1252594b4c7557` |
| Immutable RED-source parent | `3efce8367df9fd9a8acfc647b8d2c17236511b9f` |
| Review verdict | two independent actual-diff reviews `GO`, P0/P1/P2/P3 = `0/0/0/0` |
| Real PostgreSQL status | `NOT RUN` |

The sole executable test source for this grant is:

| Fact | Exact value |
|---|---|
| Path | `services/api/tests/integration/test_investigation_bridge_bindings_pg.py` |
| Git blob | `795b3d725b063efad9a1800f58ca067381a1e957` |
| Bytes | `107188` |
| SHA-256 | `a1481ba76aa680ddd6718f46e97b3d8c74b29291b19e3f0d16465f7beae483ab` |
| Guarded evidence | `48 collected`, `48 skipped`, no database attempt with the gate unset |

The exact initial RED selector is:

```text
services/api/tests/integration/test_investigation_bridge_bindings_pg.py::test_schema_force_rls_parent_pin_and_projection_text_shape
```

The full 48-test PostgreSQL file is deliberately not opened by this initial grant. Before `0026`
exists, a full run would create repetitive fixture/setup noise rather than a narrower attributable
RED. The selected catalog test reaches the real runtime role and proves the accepted schema is
absent before any production implementation begins.

The exact SOC SHA preserves the temporary `g_u2b_red` marker/exclusion for the accepted G-U2B
future-contract surface and adds a separate `@g-u1-red` tag/exclusion for exactly the accepted 32
browser RED tests in six files. Hosted `api` success therefore means non-G-U2B regression health;
hosted `e2e` success means only non-G-U1 browser regression health. Neither is the corresponding
GREEN proof. The runtime command below positively selects `g_u2b_red`; each tag and its CI
exclusion must be removed together with its own GREEN implementation line.

## 3. Exact permitted runtime

One logical attempt may perform only this sequence:

1. Re-observe the identities and hashes in section 2 from a clean SOC worktree at the exact commit.
2. Confirm the Python runtime and already-installed dependencies without installing or upgrading
   anything. The prepared runtime observation is Python `3.12.13`, pytest `9.1.1`, SQLAlchemy
   `2.0.51`, asyncpg `0.31.0`; the Python executable SHA-256 observed during preparation is
   `fe46716a94d8efa4514feb3c39ba3e270deee2187556986f6ddcff54aba7bb9a`.
3. Use one already-present `postgres:16-alpine` image. Absence of the image is `HOLD`; no image
   pull, package install, upgrade, or alternate major version is allowed.
4. Start one disposable PostgreSQL container on a newly created Docker internal network, publish
   its port only to `127.0.0.1`, and use a unique test-only container/database name. No other
   service, broker, UI, browser, or Cybrik stack component may start.
5. Bootstrap only the three repository-standard throwaway roles `cybrik_migrator`, `cybrik_app`
   and `cybrik_auth` as `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, following the
   existing `.github/workflows/ci.yml` PostgreSQL-16 pattern. Generate a fresh attempt-local
   password and never record it in stdout, evidence, Git, shell history, or this packet.
6. Apply only the migrations already committed at SOC commit `5e13e50f...` to the fresh disposable
   database with the migrator URL. No migration source may be edited, generated, stamped, skipped,
   downgraded, or repaired.
7. Before pytest collection, connect once through the same application URL and run one read-only
   catalog query that must return exactly `current_user=cybrik_app`,
   `session_user=cybrik_app`, `rolsuper=false`, `rolbypassrls=false`,
   `database_owner=false` and `public_schema_owner=false`. Any other value is an invalid
   environmental failure and stops before the RED selector. The query may inspect only
   `pg_roles`, `pg_database` and `pg_namespace`; its evidence must omit the URL and password.
   Table/function owner and executor privilege are deliberately not claimed here: the valid RED
   requires the two contract tables to be absent, and those least-privilege checks remain a
   mandatory GREEN gate.
8. Run exactly the selector in section 2 once with `CYBRIK_TEST_DB=1`, the same application URL,
   `-m g_u2b_red`, and `--maxfail=1`. Zero selected tests or any deselection of the exact selector
   is an invalid environmental failure. The working directory is exactly `services/api` in the
   pinned SOC worktree.
9. Capture redacted evidence, then remove the container, internal network, disposable volume and
   attempt-local credentials. Verify their absence before the attempt ends.

Runtime is bounded to one initial 600-second cycle and, only when the test or migration command is
still making healthy progress, one final extension of at most 600 seconds. There is no third cycle.

## 4. Valid RED and invalid environmental failures

A valid RED requires all of the following:

- PostgreSQL reports major version `16`;
- committed migrations reach their current head successfully in the disposable database;
- the pre-test application session proves the exact six-value role posture in section 3;
- the selected test is collected and executed, not skipped or deselected;
- the application connection is `cybrik_app`, `rolsuper=false`, `rolbypassrls=false`;
- the test exits non-zero because the accepted G-U2B replay/binding schema is not implemented at
  the pinned commit; and
- the failure is attributable to the missing `alert_investigation_replay_keys` /
  `alert_investigation_bindings` contract, not to test syntax, import setup, credentials,
  connectivity, a wrong role, or a failed pre-existing migration.

The following do not count as RED evidence and require immediate stop:

- skip, deselection, collection error, missing Python dependency, or wrong test selector;
- authentication, DNS, socket, Docker, health-check, disk, migration-bootstrap or role-posture
  preflight failure;
- use of a superuser or `BYPASSRLS` application connection;
- connection to any database not created for this exact attempt;
- any production/staging URL, credential, data, traffic or configuration; or
- a failure caused by source drift or a dirty worktree.

A valid RED opens only a separately reviewed proposal for the minimum GREEN implementation. It
does not itself authorize any product byte.

## 5. Evidence contract

Before the container starts, create one attempt-specific directory outside every repository under:

```text
/Users/hoanglinh/.local/state/cybrik-g-u2b-db-red-5e13e50f/<attempt-id>/
```

The directory must be owned by the current user, mode `0700`, initially empty, and must contain
only redacted evidence:

- exact Suite/SOC commit, tree, blob, byte and SHA-256 observations;
- clean-worktree and exact-selector observations;
- Python/package and PostgreSQL versions;
- container image ID already present before execution;
- loopback bind, internal-network and disposable-name facts;
- database/role posture including the exact six-value preflight result and excluding every
  password or connection URL;
- migration current-head result;
- pytest command shape with URLs/passwords redacted, exit code and output;
- start/end timestamps and elapsed time;
- teardown commands/results and verified absence of container/network/volume; and
- final `VALID_RED`, `INVALID_ENVIRONMENTAL_FAILURE`, or `STOP` disposition.

No evidence file may contain an authorization secret, connection password, private key, production
identifier or real alert/tenant/user data.

## 6. Stop and rollback

Stop before connection or immediately during execution on any identity/hash mismatch, dirty or
staged path, non-loopback exposure, image pull/install prompt, dependency change, unexpected
service start, pre-existing database target, real data, secret exposure, third-party network use,
scope expansion, timeout, or teardown failure.

Rollback is removal of the exact disposable container, internal network, volume, evidence-temporary
credential material and database. Evidence is preserved read-only and redacted. No repository
reset, stash, rebase, checkout, force operation or deletion of unrelated user state is allowed.

If teardown cannot be proven, the disposition is `STOP — RESIDUAL TEST RUNTIME PRESENT`; no retry
or GREEN proposal may begin until that residual is independently resolved.

## 7. Explicit exclusions

This grant does not authorize:

- any repository byte change, staging, commit, push, merge or release;
- migration `0024`, `0025` or `0026` implementation;
- adapter, port, replay service, route, UI, workflow or dependency changes;
- the other 47 PostgreSQL tests or any unrelated test suite;
- an externally reachable listener or any network bind other than `127.0.0.1`;
- UAT, demo, POC, RC, stable-v1.0, GA or readiness claims; or
- any production action, which remains Founder-only.

## 8. Decision and review record

| Item | Current value |
|---|---|
| First independent review | `NO-GO`, P1 = missing structured admission |
| R1.2 structured-admission review | `GO`, P0/P1/P2/P3 = `0/0/0/0` |
| Delegated Governor decision | `GO — prior singleton authority is validly withdrawn and every R1.3 pre-start gate is satisfied` |
| Runtime authorization | `RUNTIME_AUTHORIZED — exactly one Section 3 attempt and the single Section 2 selector` |
| Execution | `NOT RUN` |
| PostgreSQL RED | `NOT PROVEN` |
| GREEN implementation | `HOLD` |
