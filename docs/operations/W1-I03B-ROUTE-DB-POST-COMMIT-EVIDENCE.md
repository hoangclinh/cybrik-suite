# W1-I03B SOC route-DB landing — post-commit evidence record

- **Prepared:** 2026-07-27, twelfth same-day control record
- **Status:** `RECORDED — POST-COMMIT EVIDENCE — LOCAL SCAFFOLD COMMIT, INDEPENDENTLY REVIEWED — NOT PUSHED, NOT MERGED, NOT INTEGRATED`
- **Record author:** logical task **W0-D04** (post-commit evidence reconciler), under the
  coordinator-delegated Founder authority recorded in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.21
- **Subject:** the completed **cycle-2** outcome of the landing grant
  `docs/operations/W1-I03B-ROUTE-DB-LANDING-GRANT.md`: the granted writer landed the
  `PAUSED — UNCOMMITTED` two-path W1-I03B tree as **exactly one local commit** with **zero
  product byte edits**, and the independent **W0-R02D** post-commit review returned **PASS with
  no P0–P2**
- **Classification recorded:** `SCAFFOLD` — **local, independently reviewed, unmerged and
  unpushed product evidence toward the route-against-DB portion of live-shadow blocker 3 only**.
  It is **not** runtime, CI, deployment or release evidence
- **Authority boundary:** this document records already-taken outcomes; it opens no writer,
  grants nothing, authorizes no next lane, flips no gate and closes no residual

All SOC facts below were obtained **read-only** from the product repository by the control
session authoring this record — live Git inspection, `git hash-object`/`git rev-parse`
measurement, byte comparison of the base blob against the committed file, and read-only reading
of the three lane transcripts. **No product byte was written, nothing was staged in the product
repository, and no product command other than read-only inspection was run.**

## 1. The commit — re-verified live and read-only, 2026-07-27

| Item | Measured value |
|---|---|
| Repository / worktree | `cybrik-soc-command-center`, existing worktree `cybrik-worktrees/w1-48/w1-i03b-route-db-permanence-r1` |
| Branch | `codex/w1-i03b-route-db-permanence-r1` |
| Commit | `6464cfbfc99ecf2109988dff0e6164c8cac6b10a` |
| Parent | `f4d234bba09ae1bea7a63b3348be3640a701065d` — exactly the grant §3.1 base |
| Subject, byte-exact | `test(soc): add alert-context route-DB test + gated CI block (SCAFFOLD)` |
| Commits above base | **1** — `git rev-list --count f4d234b..HEAD` = 1; no amend, no second commit |
| Working tree | **clean** — `git status --porcelain -uall` empty; **zero staged**; no stash |
| Upstream / push / tag | **none** — `fatal: no upstream configured`; no tag points at the commit; nothing pushed |

The `origin` remote configured in that repository
(`https://github.com/hoangclinh/cybrik-soc-command-center.git`) is **pre-existing and was not
touched**; no fetch, push or remote configuration was performed by the lane or by this record.

### 1.1 Landed bytes — exactly the pinned bytes, nothing else

`git show --numstat` on the commit returns **exactly two paths, `+641 / −0`**, both mode
`100644`, with no third path:

| Path | Change | Blob in `HEAD` tree | Grant §4 pin |
|---|---|---|---|
| `.github/workflows/ci.yml` | modified, `+66 / −0` | `25e22c765c599fe832457715c12ab0790fd53fd0` | matches |
| `services/api/tests/integration/test_alert_context_route_db.py` | added, `+575 / −0` | `386075950bb5c5d910d67ca9af99a937fbc65e53` | matches |

The `ci.yml` **base blob** at `f4d234b…` re-measures `97724c6ffb53df4389942b865bbd5c0f6c61a923`
— the grant §4 row-3 pin. Byte-comparing that base blob against lines 1–392 of the committed
file returns **identical**: the base's **392 lines are byte-unchanged**, the file is **458 lines**
after a single appended hunk, and the appended **66-line `alert-context-route-db` job** carries
**`if: false` at job level** (committed line 418) and self-labels `STATIC CI WIRING, NOT WIRED`.
**Zero existing-job, step, env or trigger edits.** The new test module is **575 lines** with
**exactly 9 test functions** (lines 254, 289, 323, 342, 366, 397, 429, 452, 520) and **synthetic
data only** — generated UUID keys, a `SOSIM`-labelled synthetic alert, a throwaway
integration-only literal and `env:`-indirected secret references; no real tenant, org, alert or
identity, and no secret.

The committed bytes are therefore **byte-identical** to the bytes the grant hash-pinned while
they were dirty. The grant's zero-product-byte-edit rule held.

## 2. Cycle-2 writer session and runtime — inside the initial cycle, no extension

- The writer was **Opus 5** in session **`ee417d7b-9f89-46ca-85a9-a06d86e55f4e`** — a
  brand-new session, **not** the exhausted cycle-1 session. Its transcript carries that
  session ID uniformly across all 151 lines and spans `2026-07-27T00:11:26Z → 00:30:04Z` UTC.
- **Both phases ran in that one session.** Phase 1 (read-only revalidation, stopping before
  staging with zero staged) and phase 2 (the single commit) are the same transcript, the same
  session ID.
- **Runtime, as measured by the dispatching wrapper:** phase 1 **551 s**, phase 2 **41 s**,
  **total active wrapper time 592 s ≤ the 600 s initial cycle**. **No extension was requested
  or used**, so board §15's single-extension allowance was not drawn on at all. Two other
  clocks appear in the evidence and are recorded rather than reconciled away: the transcript
  event spans are **550.1 s** and **39.4 s**, and the writer's own phase-1 self-report claimed
  **487 s**. The wrapper measurement is the governing one and is the largest of the three, so
  the ≤ 600 s conclusion holds on any of them. The idle gap between phases is the grant's own
  §7.1 → §7.3 stop-for-review design, not clock evasion.
- The exhausted cycle-1 session **`2aa3bab1-bf56-4161-ac04-b4f67810691c` was never resumed**.
  Its transcript's last write is 44 minutes before phase 1 began and is unchanged since; its
  only appearances inside the writer transcript are quotations of the grant text.
- **The grant is now terminal and consumed.** It authorized exactly one commit, that commit
  exists, and its authority ends there. **No third W0-D04 prospective grant exists or may be
  issued for this landing scope.**

## 3. Independent reviews — two fresh reviewers, both distinct

| Review | Session | Outcome |
|---|---|---|
| **W0-R02C** — fresh independent Fable **pre-commit** review of the dirty tree | `e0523704-0212-4977-b1dd-5aba59ee1728` | **GO — no P0–P2**, P3 findings only |
| **W0-R02D** — fresh independent Fable **post-commit** review of the commit | `551047a5-e20f-42f7-bbf8-eee1560bd080` | **PASS — no P0–P2**, P3 findings only |

Reviewer separation holds as grant §7.2/§10 require: the writer (`ee417d7b…`), the cycle-1
dirty-tree reviewer **W0-R02B** (`ae278ef3-f77b-44be-8a04-3f2285fe4217`), W0-R02C
(`e0523704…`) and W0-R02D (`551047a5…`) are **four distinct sessions**. Neither reviewer is
W0-R02B, and neither is the W0-IR11 governance reviewer. W0-R02C's **GO** was issued at
`00:28:44Z`, **before** the staging step at `00:29:51Z` — the grant's ordering held.

### 3.1 W0-R02C's correction of the writer's report — recorded, and the wrong claim retired

The writer's phase-1 report stated that the byte-compile wrote **"no `__pycache__` … into the
repo"**. **That claim is incorrect and is not repeated anywhere.** W0-R02C established, and
W0-R02D and this record independently re-verified, that the grant-authorized byte-compile
created:

```
services/api/tests/integration/__pycache__/test_alert_context_route_db.cpython-314.pyc
```

at `00:13:21Z`, inside the phase-1 window — `python -m py_compile` writes its output regardless
of `PYTHONDONTWRITEBYTECODE`, and the writer's residue probe (a BSD-incompatible
`find … -newermt`) failed silently. The artifact is **gitignored** (`.gitignore:10`,
`__pycache__/`, confirmed by `git check-ignore -v`), **untracked**, invisible to
`git status -uall`, and **could not enter the commit object** — the two committed blobs match
the pins exactly. Per grant §5's no-deletion rule it was **recorded, not deleted and not
staged**, and it remains on disk. A pre-existing `…cpython-312.pyc` from the cycle-1 window sits
beside it and is likewise untouched. The writer's own commit body carries this correction.

## 4. Executed evidence — local runs, personally performed in phase 1

The cycle-2 writer **personally ran** the following in phase 1, before any staging. These are
**local runs, not CI results**, and every figure carries the §5 borrowed-venv caveat.

| Item | Result |
|---|---|
| New module against real **PostgreSQL 16.14** | **9/9 passed** (4.38 s), in-process ASGI against a real database migrated to alembic head `0023` |
| Whole `tests/integration` directory | **503 passed / 5 skipped / 0 failed** (211 s) |
| Skip-clean run without `CYBRIK_TEST_DB` | **9 skipped** — no failure, no error, no import error, no silent pass |
| Static checks | `ruff check` clean, `ruff format --check` clean (**check modes only** — `ruff format` and `--fix` were never invoked), byte-compile clean; W0-R02D independently re-ran `ruff` check modes and `ast.parse` on the committed bytes — clean |
| Container hygiene | already-present local `postgres:16-alpine` image, **no pull**; one throwaway no-egress container bound to `127.0.0.1` only; container **removed** (`docker ps -a` filter count 0) and its uniquely attributable **anonymous volume removed**; `/tmp` scratch deleted; image untouched |
| Data | fully synthetic throughout; no real tenant/org/alert/identity, no secret, no network egress |

**These are local, not CI.** The appended CI job is `if: false`, **CI is NOT WIRED**, and **no
CI result is claimed** anywhere.

## 5. Caveats that travel with every citation of the above

1. **Borrowed-venv dependency caveat.** This worktree has no Python environment with the
   repository's dependencies. To run anything, the writer borrowed the **pre-existing** venv at
   `cybrik-soc-command-center/services/api/.venv` (CPython 3.12.13) — **no install, upgrade or
   download**. Because that venv's editable install points at the **main** repository's `src`
   tree, which differs from this base's, the writer forced
   `PYTHONPATH=<this worktree>/services/api/src` and **probe-verified** that `cybrik_soc`
   resolved to the worktree source. Third-party **dependency versions therefore did not come
   from this base's pins**. This taints the **evidentiary weight of the local runs only** — never
   the hash-pinned landed bytes. The caveat must accompany the 9/9 and the 503/5 figures
   wherever they are cited.
2. **`mypy` / `actionlint` remain unavailable** without a forbidden install; W0-R02C and
   W0-R02D each re-confirmed neither is on `PATH` or in the venv. The finding stays **open** as a
   deferral to CI — and **CI is NOT WIRED**, so the deferral is **open-ended, not satisfied**.
3. **RED / test-first chronology is permanently unverifiable.** It is cited **as reported
   only** and was never reconstructed, re-enacted or inferred. **No verified TDD and no verified
   RED→GREEN is claimed for this lane, now or ever.**
4. **The cycle-1 `cryptography` caveat is retained.** The cycle-1 available-backend-slice figure
   `2740 passed / 6 skipped / 1 environment failure` keeps that caveat wherever cited. The
   cycle-2 borrowed venv happens to have `cryptography`, so the failure did not reproduce — that
   does **not** resolve the cycle-1 finding, which is out of scope.

## 6. P3 findings — all open or explicitly dispositioned; none blocking

No P0, P1 or P2 finding was raised at any point in cycle 2, by either review or by this record.

| # | P3 | Standing |
|---|---|---|
| 1 | **RED chronology** — test-first evidence unverifiable by citation | **Permanent evidence gap.** Never reconstructed; only ever cited "as reported"; disclosed in the commit body |
| 2 | **`mypy`/`actionlint` deferral** | **Open-ended** — deferred to a CI that is **NOT WIRED** |
| 3 | **Cycle-1 `cryptography` caveat** | Retained on the cycle-1 backend-slice figure; out of scope here |
| 4 | **Cosmetics** — import-time `os.environ.setdefault` at test **line 78**; non-English `noqa: S608` rationale fragment at test **line 97**; and the **`docs/operations/README.md` index omission** | Present and **deliberately unfixed**. Fixing the first two would have been a forbidden product byte edit. The README omission is **outside this record's §14.21.1 allowlist**, so it **persists**, now also omitting this record — recorded, not silently fixed |
| 5 | **Borrowed-venv dependency caveat** | Open — see §5.1; disclosed in the commit body |
| 6 | **`.pyc` correction and residue** | The writer's "no `__pycache__` written" claim is **corrected**, and the gitignored `cpython-314.pyc` is **recorded, not deleted, not staged** — see §3.1 |
| 7 | **Session self-attribution gap** | `$CLAUDE_SESSION_ID` was unset in the writer's shell and it honestly declined to guess its own UUID. Identity was resolved through the **uniform internal `sessionId` field across all 151 transcript lines** plus the coordinator's dispatch record, which agree. That is sufficient for this record, but the **caveat persists**: the writer did not self-attest its session ID |
| 8 | **Regression slice beyond strict enumeration** | The whole-`tests/integration` run (503/5) exceeds grant §7.4's "only the following" list. Read-only in effect, on the same authorized container, evidence-strengthening; both reviews concurred no §9 STOP was triggered. Recorded rather than treated as compliant-by-default |
| 9 | **Trivial transcript artefact** | `PYTEST_EXIT=${PIPESTATUS[0]}` printed **empty** under `zsh`; the definitive evidence is the `9 passed` summary line. Cosmetic only |
| 10 | **Control validator does not machine-enforce this governance** | `tools/operations/validate-w1-control.mjs` checks documentary consistency over pinned control rows only. It does **not** enforce board §14.20/§14.21, register §15/§16, the grant terms, the hash pins or the reviewer-separation rule. Its `PASS` is **not** evidence that this record's governance held |
| 11 | **W0-IR11 has no standalone artifact** | The W0-IR11 governance decision that founded the landing grant exists only as it is quoted in board §14.20/§1.12 and the grant text; no separate reviewed artifact is filed. Recorded as a provenance gap |
| 12 | **Placeholder Git author identity — corrected scope** | **This control repository** commits under the placeholder identity `Your Name <your@email.com>`, which is a real provenance weakness in the control record. Measured honestly, the **SOC commit `6464cfb` does not** share it: its author and committer are `Hoang Chi Linh <linhhc.eco@gmail.com>`. The finding is recorded against the control repository only |

## 7. Classification after W0-R02D

With the post-commit **PASS**, commit `6464cfbfc99ecf2109988dff0e6164c8cac6b10a` counts
**only** as:

> **local, independently reviewed, unmerged and unpushed `SCAFFOLD` product evidence toward the
> route-against-DB portion of live-shadow blocker 3.**

It is explicitly **not** runtime evidence, **not** CI evidence, **not** deployment evidence and
**not** release evidence. Nothing in this lane is `IMPLEMENTED`, `VERIFIED`, `PILOTED` or `GA`.

## 8. Residual — what did not close

- **The route-DB permanence residual is NOT closed.** Board §1.3's "the route-against-DB probe
  ran from `/tmp` and is **not** a permanent CI job" stands. **Permanence requires push plus
  observed remote green**, and **push remains `NO-GO`**. The appended job stays **strictly
  static CI wiring** — `if: false`, **CI: NOT WIRED**, **no CI result claimed** — and may never
  be called permanent, wired, running or green. Un-gating it is a future decision's commit, not
  this one's.
- **Live-shadow blocker 3 stands open as a whole** — `shadow_remote`, **real org mapping**, TTL
  enforcement and the **live bundle** path are all untouched and outside this lane. Blockers 1,
  2 and 4 are unchanged.
- **G2 and G3 stay closed**; GATE A4 and W1-C1/C2 stay `ACCEPTED — CLOSED 2026-07-26`; W1-G1
  stays `ACCEPTED — CLOSED 2026-07-27`.
- **W1 integration / live shadow stays `HOLD` / `NO-GO`**; W1 runtime writers, delegated routine
  integration and external release stay `NO-GO`; **`W0 COMPLETE=0`** and W0 closure stays
  `NO-GO`; the board §11 exit criteria remain unmet.
- **Dates are unchanged:** W1 formal dates **2026-08-01 → 2026-08-23**, all W0–W6 dates, and the
  **2026-12-21 → 2026-12-31** release window.

## 9. What this record does not authorize

- **The next lane is NOT authorized by this evidence record.** Any follow-on work — push,
  remote-green pursuit, un-gating the CI job, `shadow_remote`, real org mapping, TTL, the live
  bundle path, disposal of this branch, or folding it into the formal W1 window — is **queued
  for a fresh Fable decision and a prospective grant**, and several of those additionally
  require an explicit **Founder decision**. This record **opens no product authority**.
- No push, merge, remote configuration, tag, release, G2 or G3 action; no dependency install; no
  formatter or auto-fixer; no database, container, microVM, netns or broker started by this
  record; no secret read; no status promotion beyond §7.
- The fixed roster of **48** stands with **no task 49**; category counts stay
  I 12 · T 12 · R 6 · S 5 · B 5 · IR 4 · D 4. `W0-IR11`, `W0-R02C` and `W0-R02D` name
  **reviews and decisions, not task identities**.
- The Fabric W0-I07 lane (board §1.7) and the Cyber AI W0-I06 lane (board §1.9) are untouched.
- The pre-existing unrelated dirty edit in `docs/strategy/06-ROADMAP-2026-2029.md` was preserved
  byte-for-byte untouched and unstaged — hash-pinned before and after this record's writes in
  board §14.21.4.

## 10. Provenance

- Bounded record-authoring authority and control-side measured evidence: board §14.21 (allowlist
  §14.21.1; verified evidence §14.21.2; measured evidence §14.21.4); board summary §1.13.
- Matching register entry: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §16.
- The consumed landing grant this cycle ran under, standing **unedited** as dated history:
  `docs/operations/W1-I03B-ROUTE-DB-LANDING-GRANT.md` (board §1.12/§14.20; register §15).
- The cycle-1 grant and its hard stop, both standing **unedited** as dated history:
  `docs/operations/W1-I03B-ROUTE-DB-PERMANENCE-GRANT.md` (board §1.10/§14.18; register §13) and
  `docs/operations/W1-I03B-ROUTE-DB-HARD-STOP-EVIDENCE.md` (board §1.11/§14.19; register §14).
- Lane transcripts read read-only for this record: writer
  `ee417d7b-9f89-46ca-85a9-a06d86e55f4e`, W0-R02C `e0523704-0212-4977-b1dd-5aba59ee1728`,
  W0-R02D `551047a5-e20f-42f7-bbf8-eee1560bd080`.
- Prior dated records of the lane and its residuals: board §1.3/§14.11; register §6.
- The reviewed base this lane builds on: commit `f4d234b…`, W0-R02 re-review `PASS`.
