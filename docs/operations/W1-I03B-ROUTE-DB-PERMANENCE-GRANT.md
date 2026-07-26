# W1-I03B SOC route-DB permanence — prospective bounded grant

- **Prepared:** 2026-07-27, ninth same-day control record
- **Status:** `ACTIVE — PROSPECTIVE BOUNDED GRANT — LOCAL DOCS ONLY, NOT PUSHED`
- **Grant author:** logical task **W0-D04** (prospective-grant author), under the
  coordinator-delegated Founder authority recorded in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.18
- **Grantee:** fixed roster task **W0-I03**, sub-lane **W1-I03B** — the same immutable identity;
  **no task 49** and no replacement identity is created by this grant
- **Subject:** bounded, **test-first** permanence work on the SOC alert-context
  route-against-DB residual of board §1.3 — one permanent in-repo integration test driving the
  in-process ASGI route against real local PostgreSQL 16, plus **one strictly static,
  hard-gated CI job block** — in a **new** worktree of `cybrik-soc-command-center` off the
  clean reviewed base `f4d234bba09ae1bea7a63b3348be3640a701065d`
- **Decision basis:** the **W0-IR10 decision**, relayed under coordinator-delegated Founder
  authority in this record's tasking — it opens exactly one bounded W1-I03B attempt at the
  route-against-DB permanence residual that board §1.3 records as open ("the route-against-DB
  probe ran from `/tmp` and is **not** a permanent CI job"). `W0-IR10` labels that decision;
  it is **not** a roster task identity — the fixed roster of 48 is unchanged and no task 49
  exists
- **Authority boundary:** this document records a **prospective grant only**; the control
  session that authored it wrote no product byte, and nothing is promoted by this grant
  existing

This grant authorizes exactly one future bounded writer attempt under the terms below. It
accepts nothing, flips no gate, closes no residual by itself, and is **not product evidence**;
the residual it addresses stays open until the writer completes under these terms and both of
the grant's reviews pass — and the "permanent CI job" half of that residual **cannot close at
all** from local work (§5).

## 1. Basis — W0-R02 `PASS` lane at a clean reviewed base; re-verified live

**Base facts, re-verified read-only on 2026-07-27** from the control session that authored
this grant: repository `cybrik-soc-command-center`, existing worktree
`w1-i03-soc-context-runtime-r1`, branch `codex/w1-i03-soc-context-runtime-r1`, tip
`f4d234bba09ae1bea7a63b3348be3640a701065d` — subject `test(org): advance Alembic head guard`,
parent `ff1aec3e591283ac00cb6665f3f4bb57ccb68ff6` — working tree **clean, zero staged**. This
is the remediation commit that the independent **W0-R02** review re-reviewed **`PASS`** (board
§1.3; register §6).

**Repository conventions at the base, re-verified read-only on 2026-07-27:**

- `services/api/tests/integration/conftest.py` already gates the whole integration directory
  with `pytest.mark.skipif` on `CYBRIK_TEST_DB != "1"` ("integration tests require real
  PostgreSQL (set CYBRIK_TEST_DB=1 in CI)") — the skip-clean discipline the new test must
  inherit;
- `org_context_incomplete` is the established fail-closed refusal reason in
  `services/api/src/cybrik_soc/modules/alert/context/authorize.py` and `…/context/wire.py`;
- the CI workflow `.github/workflows/ci.yml` `api` job is the **Postgres service precedent**:
  `postgres:16-alpine` service container with `pg_isready` health checks, a
  `Bootstrap DB roles (dev/CI only)` step creating `cybrik_migrator`/`cybrik_app`/`cybrik_auth`
  as `LOGIN … NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` with throwaway
  `ci-only-password` credentials, and `CYBRIK_TEST_DB: "1"` /
  `CYBRIK_DATABASE_URL: postgresql+asyncpg://cybrik_app:…@localhost:5432/cybrik_soc` env;
- **neither allowlisted artifact exists yet at the base:** there is no
  `services/api/tests/integration/test_alert_context_route_db.py` and no
  `alert-context-route-db` job anywhere in the workflow.

**Residuals this lane addresses, as recorded (board §1.3; register §6):** at `f4d234b…` the
reported real-PostgreSQL evidence (PostgreSQL 16.14; runtime roles `NOBYPASSRLS`;
`FORCE ROW LEVEL SECURITY`; migration 0023 roundtrips; `10` focused + `58` migration/RLS +
`258` alert-context + `6` temporary ASGI route probes; full backend `3016 passed`) left
explicitly open: the route-against-DB probe ran from `/tmp` and is **not a permanent CI job**;
a **true multi-connection race proof** remains open; the org-enabled route stays inert and
fail-closed. This grant targets exactly the first of those plus the in-test halves of the
other two; TTL enforcement, `shadow_remote` and the live bundle path are **outside** this
grant entirely.

## 2. Writer binding — repo, base, new branch/worktree, session, runtime

1. **Repo/base/branch/worktree:** `cybrik-soc-command-center`, exact clean reviewed base
   `f4d234bba09ae1bea7a63b3348be3640a701065d`; a **new** branch
   `codex/w1-i03b-route-db-permanence-r1` in a **new** isolated worktree
   `cybrik-worktrees/w1-48/w1-i03b-route-db-permanence-r1` created at exactly that base. If
   the observed base differs, the worktree is not new/clean at session start, or the branch
   already exists, the writer must STOP before any edit.
2. **Identity:** the same immutable task **W0-I03**, sub-lane **W1-I03B** — no identity reuse
   from another lane, no new identity, **no task 49**.
3. **Model and session:** **Opus 5**, in a **brand-new Claude session**.
4. **Runtime bound (board §15):** one initial **600 s** cycle plus **at most one** healthy
   **600 s** extension, granted only on evidenced progress. A second extension request is
   denied; quota exhaustion, permission loops, deadlock and scope drift are never grounds. At
   the bound, the writer hard-stops and reports partial evidence.

## 3. Exact product edit allowlist — two paths only

| # | Path | Kind | Bound |
|---|---|---|---|
| 1 | `services/api/tests/integration/test_alert_context_route_db.py` | **new** | the permanent route-against-DB integration test of §4 |
| 2 | `.github/workflows/ci.yml` | modify | **exactly one new `alert-context-route-db` job block appended; zero edits to any existing job, step, env, trigger or line** |

No `src/` path, no third path of any kind: no other test, no conftest edit, no fixture file,
no migration, no config, no docs, no deletion, rename or move; no dependency added, upgraded,
removed or installed; no formatter or auto-fixer run. The diff against `f4d234b…` must consist
of exactly one added file and one purely additive job block in the workflow — the workflow's
existing bytes are otherwise byte-identical.

## 4. Permitted behavior — test-first route-DB permanence, exact

1. **Test-first.** Write `test_alert_context_route_db.py` first and observe **RED** (or the
   honest skip path, §4.3, where no DB is available — but the GREEN evidence of §4.2 requires
   the real DB) before making it pass; package the RED→GREEN evidence in the writer's report.
2. **The test itself** drives the **in-process ASGI** alert-context route (no socket, no port,
   no server process) against **real local PostgreSQL 16**, selected via `CYBRIK_TEST_DB=1`
   and `CYBRIK_DATABASE_URL`, and must assert at minimum:
   - **runtime role posture** — the connected runtime role is `NOBYPASSRLS` and the
     alert-context tables enforce `FORCE ROW LEVEL SECURITY`;
   - **cross-tenant denial and non-disclosure** — a foreign-tenant request is refused without
     leaking existence, shape or count of the other tenant's rows;
   - **digest/idempotency** — repeating the same request yields the digest-stable, idempotent
     result with no duplicate persistence;
   - **two true concurrent connections** — a real two-connection contention proof (two live
     DB connections racing, not one connection interleaved), addressing the open
     multi-connection race residual of §1;
   - **org flag ON fail-closed** — with the org flag enabled, incomplete org context is
     refused with the established `org_context_incomplete` reason.
3. **Skip-clean without DB.** Without `CYBRIK_TEST_DB=1` and a reachable database, the module
   **skips cleanly** under the existing integration `conftest.py` discipline — it never fails,
   never errors at import, and never silently passes.
4. **Synthetic data only.** All tenants, orgs, alerts and identities are synthetic fixtures;
   **no network egress, no real data, no secret** — DB credentials are local, throwaway,
   test-only values.
5. **The CI job block** is **modeled on the existing `api` job Postgres service precedent**
   (§1): `postgres:16-alpine` service with health checks, the `NOBYPASSRLS` role-bootstrap
   step pattern, `CYBRIK_TEST_DB: "1"` and `CYBRIK_DATABASE_URL` env, running exactly the new
   test file — and is **hard-gated `if: false` at job level** so no CI execution is claimed or
   attempted. It touches no existing job.

Nothing else is permitted: no route/`src/` change, no schema or migration change, no
refactoring, no other test touched, no conftest change, no dependency, no formatter, no
deletion.

## 5. Classification duty — strictly static CI wiring, never "permanent" locally

The writer, both reviews and every downstream record must classify the outcome exactly:

- the CI job block is **strictly static CI wiring** — authored bytes only, hard-gated
  `if: false`, with **CI: NOT WIRED** and **no CI result claimed**;
- the board §1.3 residual "not a permanent CI job" is **not closed** by this grant or by the
  local commit: **"permanent" requires push plus remote-green evidence**, and push/remote
  action stays `NO-GO` outside this grant — until then the job may never be described as
  permanent, wired, or running;
- a completed, twice-reviewed commit counts **only** as local, independently reviewed,
  unmerged/unpushed `SCAFFOLD` evidence toward the **route-against-DB portion of live-shadow
  blocker 3**; the blocker's `shadow_remote` and **real org mapping** portions are untouched
  and stay open, so blocker 3 as a whole stands.

## 6. Review and commit protocol

1. **Writer stops before commit.** After §4 is complete (or at the §2 runtime bound), the
   writer ends its work phase with **zero staged paths** and reports; it does not stage or
   commit.
2. **Independent Fable pre-commit review.** An independent Fable session reviews the dirty
   tree. Staging and commit require an explicit **GO with no P0–P2** from that review.
3. **One bounded local commit.** After GO, the **same writer session** resumes **within its
   remaining allowed §15 time only** to stage **exactly the two §3 paths** and make **exactly
   one local commit** whose subject and body are **status-honest `SCAFFOLD`** — no
   `IMPLEMENTED`/`VERIFIED`/`PILOTED`/`GA` wording, no "permanent", "wired" or CI-green claim,
   no runtime or product promotion claim. Nothing is pushed.
4. **Fresh post-commit Fable review.** A fresh, independent Fable post-commit review follows.
   Neither the W0-R02 review nor this grant's control-side re-verification carries over as
   either required review, and the commit is **not product evidence** until it passes.

## 7. STOP conditions — immediate hard stop, report partial evidence

The writer (and the resumed commit step) must STOP immediately, with no further edit, on any
of:

1. **any source edit need** — any change under `services/api/src/` (or any product source
   path) that the test seems to require; the test must pass against the base's committed
   behavior or the attempt stops;
2. **missing PostgreSQL/image/tool requiring an install** — no local PostgreSQL 16, container
   image, driver or tool may be installed, pulled or upgraded to proceed; absence is a STOP,
   not an install prompt;
3. **any third path** — any edit, creation or deletion beyond the exact two §3 paths,
   including conftest, fixtures or docs;
4. **any existing-job modification** — any change to an existing `ci.yml` job, step, env,
   trigger, comment or line beyond appending the single new hard-gated job block;
5. **any real data** — any non-synthetic tenant/org/alert/identity, any secret, any network
   egress;
6. **timeout** — the §2.4 runtime bound reached, or any prompt to request a second extension;
7. **any remote action** — any push, merge, remote configuration, release, G2/G3, date-change
   or status-promotion action, or any attempt to run or un-gate the CI job;
8. observed base ≠ `f4d234b…`, a non-new or non-clean worktree at start, any staged path
   before the §6.3 staging step, or a pre-commit review outcome other than **GO with no
   P0–P2**.

A STOP consumes the attempt's remaining authority for that step; it never widens the
allowlist and never creates a replacement identity.

## 8. Evidence attribution

- The base commit/parent/subject, branch tip, clean zero-staged worktree state, the
  `CYBRIK_TEST_DB` conftest gating, the `org_context_incomplete` refusal-reason locations,
  the `api`-job Postgres service precedent detail, and the absence of both allowlisted
  artifacts at the base were **re-verified live, read-only** from the SOC repository on
  2026-07-27 by the control session authoring this grant; no product byte was written.
- The **W0-R02 `PASS`** re-review classification and the PostgreSQL 16.14 evidence figures at
  `f4d234b…` (roles, RLS, migration roundtrips, test counts, `3016 passed`) are **as
  reported** in board §1.3/§14.11 and register §6; none of it was re-executed from the
  control side.
- The **W0-IR10 auditor note** flagged an evidence gap in prior control records: the
  pre-existing unrelated dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was asserted
  preserved byte-for-byte but never hash-pinned. This record closes that gap: board §14.18.4
  records the file's `git hash-object` measured **before and after** this record's writes —
  both `4ed13159a7afc104694dea8b2f2773003cdf8831` — and the file stays unstaged.

## 9. What this grant does not authorize

- **No push, no merge, no remote change, no release, no dependency install, no formatter.**
- **No product source edit** anywhere, in any repository — this lane is test-and-CI-bytes
  only.
- **No `shadow_remote` work and no real org mapping** — those blocker-3 portions stay open
  and separately gated; TTL enforcement and the live bundle path likewise stay outside this
  grant.
- **G2/G3 stay closed**; W1 integration/live shadow stays `HOLD`/`NO-GO`; `W0 COMPLETE=0` and
  W0 closure stays `NO-GO`; the board §11 exit criteria remain unmet. A committed,
  twice-reviewed result would bear only on the **route-against-DB portion of live-shadow
  blocker 3** as local `SCAFFOLD` evidence — and only after the §6.4 review passes; nothing
  is promoted by this grant itself, and the CI job stays **NOT WIRED** and never "permanent"
  without push + remote green.
- **No date change:** W1 formal dates 2026-08-01 → 2026-08-23, all W0–W6 dates and the
  2026-12-21 → 2026-12-31 release window are unchanged.
- **No status promotion:** the resulting commit, if any, carries `SCAFFOLD` status honesty
  and becomes product evidence only after the §6.4 post-commit review passes; no gate in
  board §1 moves on this grant alone.
- The Fabric W0-I07 and Cyber AI W0-I06 lanes (board §1.7, §1.9) are untouched by this grant.

## 10. Provenance

- Bounded grant-authoring authority and control-side measured evidence: board §14.18
  (allowlist §14.18.1; basis evidence §14.18.2; measured evidence §14.18.4, including the
  roadmap hash pin); board summary §1.10.
- Matching register entries: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §13.
- Prior dated records of the lane and its residuals: board §1.3/§14.11 (SOC runtime-evidence
  reconciliation, blockers list); register §6.
- The reviewed base this lane builds on: commit `f4d234b…` on branch
  `codex/w1-i03-soc-context-runtime-r1` in `cybrik-soc-command-center`, W0-R02 re-review
  `PASS`.
