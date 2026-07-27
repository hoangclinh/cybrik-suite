# W1-I03B SOC route-DB landing — prospective bounded grant

- **Prepared:** 2026-07-27, eleventh same-day control record
- **Status:** `ACTIVE — PROSPECTIVE BOUNDED GRANT — LANDING ONLY — LOCAL DOCS ONLY, NOT PUSHED`
- **Grant author:** logical task **W0-D04** (prospective-grant author), under the
  coordinator-delegated Founder authority recorded in
  `docs/operations/W1-48-AGENT-ROLLING-BOARD.md` §14.20
- **Grantee:** fixed roster task **W0-I03**, sub-lane **W1-I03B** — the same immutable identity
  as the grant it follows; **no task 49** and no replacement identity is created by this grant
- **Subject:** a **landing-only** remediation of the `PAUSED — UNCOMMITTED` two-path dirty tree
  that `docs/operations/W1-I03B-ROUTE-DB-HARD-STOP-EVIDENCE.md` records — **zero product byte
  edits**; the only permitted product-repository mutations are the Git **index** and **one**
  local commit object, landing the already-authored bytes **unmodified** and hash-verified
- **Decision basis:** the **W0-IR11 decision** — an independent Fable governance review of this
  landing scope returning **GO with no P0–P2**, finding the scope distinct from the consumed
  cycle-1 authoring scope and **non-evasive** of the board §15 runtime bound. `W0-IR11` labels a
  coordinator-delegated decision; it is **not** a roster task identity — the fixed roster of 48
  is unchanged and no task 49 exists
- **Cycle:** **cycle 2** for sub-lane **W1-I03B**. Cycle 1 was the authoring cycle granted by
  `docs/operations/W1-I03B-ROUTE-DB-PERMANENCE-GRANT.md`, which hard-stopped
- **Authority boundary:** this document records a **prospective grant only**; the control
  session that authored it wrote no product byte, staged nothing, and nothing is promoted by
  this grant existing

This grant authorizes exactly one future bounded landing attempt under the terms below. It
accepts nothing, flips no gate, closes no residual by itself, and is **not product evidence**.
The residual it bears on stays open; the "permanent CI job" half of that residual **cannot
close at all** from local work (§6).

## 1. Basis — the recorded hard stop, and why a landing grant is the correct instrument

`docs/operations/W1-I03B-ROUTE-DB-HARD-STOP-EVIDENCE.md` (board §1.11/§14.19; register §14)
records the outcome of cycle 1: the granted writer produced exactly the two allowlisted dirty
paths at the exact grant base, the independent **W0-R02B** review returned **technical GO with
no P0–P2 and three P3**, and the writer then **hard-stopped** at the board §15 bound. Because
the consumed grant §6.3 bound staging and commit to "the **same writer session** … within its
remaining allowed §15 time only", and that remaining time is zero, the commit path inside
cycle 1 is closed. That record left future action **queued, not decided and not granted**,
conditioned on: a fresh prospective bounded grant recorded before work; no resumption of the
exhausted session and no identity reuse or minting to evade the §15 timeout; resolution or
explicit disposition of the three W0-R02B P3 findings; and the new grant's own independent
pre-commit and post-commit reviews.

This grant is that instrument, and it satisfies each of those four conditions: it is recorded
before any work (§2–§5); it binds a **brand-new** session and the **same** immutable identity
(§3); it dispositions all three P3 findings explicitly (§8); and it mandates two fresh
independent reviews by reviewers distinct from every prior reviewer of this lane (§7).

### 1.1 Why the scope is distinct, and why it is not §15 evasion

The distinction is not one of degree. Cycle 1 was an **authoring** scope: its allowlist
permitted writing a new test file and appending a workflow job block — new product bytes. This
grant's scope is **landing only** and permits **zero product byte edits** (§5). The two
already-authored files must be staged and committed **byte-identical to the hashes pinned in
§4**; any byte change whatsoever is a STOP condition (§9). No new product behavior, no new
test, no fix, no formatting, no reflow, no comment change is authorized — not even to address
the cosmetic observations this grant itself records in §8.4.

That is why this is not evasion of the §15 bound. The §15 rule denies a **second extension**
to a task's runtime cycle and forbids using retry, identity reuse or identity minting to buy
more authoring time. This grant buys **no authoring time at all**: there is nothing left to
author, and the grant forbids authoring. It opens a fresh, separately bounded cycle whose
entire permitted output is one Git index update plus one commit object over bytes that already
exist and are hash-pinned. The exhausted session `2aa3bab1-bf56-4161-ac04-b4f67810691c` is
**never resumed** (§3.3), the task identity is unchanged, and no task 49 is minted. The
independent **W0-IR11** review reached the same conclusion — **GO, no P0–P2** — on exactly this
question.

### 1.2 Precedent — governance pattern only, not equivalence

The suite has twice applied the same governance pattern on 2026-07-27: a `PAUSED — UNCOMMITTED`
dirty tree left by a §15 hard stop was landed only after a **fresh prospective bounded grant**
placed a **brand-new Opus 5 session** on the **same immutable task identity**, with the
exhausted session never resumed and two fresh independent reviews required.

- **Fabric W0-I07** — board §1.6/§14.14 (grant) → §1.7/§14.15 (post-commit evidence); register
  §9 → §10. The 30-path tree landed as commit `d38f910a44d6454285b393cb89df4a6ade4eb855`.
- **Cyber AI W0-I06, sub-lane W1-I06C** — board §1.8/§14.16 (grant) → §1.9/§14.17 (post-commit
  evidence); register §11 → §12. The 13-path tree landed as commit
  `2baba72534297fc67130983e5bd21b5730f50c31`.

**What carries over is the governance pattern and nothing else.** Both precedents were
**remediation** grants that permitted product byte edits — Fabric permitted behavior-changing
ordering and copy fixes across five of its dirty paths; Cyber AI permitted behavior-preserving
lint/format/type remediation across named files. **This grant permits none.** It is therefore
strictly narrower than either precedent, and no claim about either lane's outcome, evidence
quality, review depth, gate effect or product maturity transfers to this one. Neither
precedent's `PASS` carries over as a review here, and neither is cited as authority for any
substantive conclusion about the SOC lane.

## 2. Terminality — this is the last prospective grant for this landing scope

This grant is **terminal for the landing scope**. If the granted attempt STOPs for any §9
reason, or reaches its §3.4 runtime bound, without producing the one authorized commit:

- **no third W0-D04 prospective grant may be issued for this landing scope** — the
  coordinator-delegated grant-authoring path for landing this tree is spent;
- the two-path dirty tree **remains `PAUSED — UNCOMMITTED` and not product evidence**,
  indefinitely;
- **disposal of the tree, or folding this work into the formal W1 window
  (2026-08-01 → 2026-08-23), requires an explicit Founder decision** — it is not available to
  W0-D04, to any reviewer, or to any coordinator-delegated authority.

No STOP widens an allowlist, extends a runtime bound, creates a replacement identity, or
authorizes a further grant.

## 3. Writer binding — existing worktree, verified state, new session, runtime

1. **Repo/worktree/branch/base — the existing attempt tree, not a new one.**
   `cybrik-soc-command-center`, the **existing** worktree
   `/Users/hoanglinh/Claude/Projects/cybrik-worktrees/w1-48/w1-i03b-route-db-permanence-r1`,
   branch `codex/w1-i03b-route-db-permanence-r1`, with **HEAD = branch tip = base =
   `f4d234bba09ae1bea7a63b3348be3640a701065d`** — no commit exists on the branch above the
   base. No new worktree and no new branch is created by this grant.
2. **Dirty-set binding.** Exactly **two dirty `-uall` paths** and **zero staged** at session
   start:
   1. `services/api/tests/integration/test_alert_context_route_db.py` — new, untracked;
   2. `.github/workflows/ci.yml` — modified.
   A third dirty path, any staged path, or any hidden staged residue at session start is a
   STOP (§9).
3. **Identity and session.** The same immutable task **W0-I03**, sub-lane **W1-I03B** — no
   identity reuse from another lane, no new identity, **no task 49**. The writer is **Opus 5**
   in a **brand-new Claude session**. The exhausted cycle-1 session
   `2aa3bab1-bf56-4161-ac04-b4f67810691c` — which consumed its initial 600 s cycle plus exactly
   one healthy 600 s extension and then hard-stopped with no third cycle — **must never be
   resumed**, and no transcript, context or authority from it may be carried into the new
   session as runtime. The new session's ID is **not known at the time of this record** and
   must be recorded in the downstream evidence record, not here; this grant deliberately leaves
   it unpinned rather than guessing it.
4. **Runtime bound (board §15).** One initial **600 s** cycle plus **at most one** healthy,
   evidence-based **600 s** extension, granted only on an observable artifact advancing. **No
   third cycle.** A second extension request is denied; quota exhaustion, permission loops,
   deadlock and scope drift are never grounds. At the bound the writer hard-stops and reports
   partial evidence — and §2 then applies.

## 4. Hash pins — the exact bytes that may land

The attempt tree's dirty bytes and the workflow's base blob were measured **read-only** from
the SOC repository on 2026-07-27 by the control session authoring this grant:

| # | Path | `git hash-object` | Kind |
|---|---|---|---|
| 1 | `.github/workflows/ci.yml` — **working copy** | `25e22c765c599fe832457715c12ab0790fd53fd0` | modified |
| 2 | `services/api/tests/integration/test_alert_context_route_db.py` — **working copy** | `386075950bb5c5d910d67ca9af99a937fbc65e53` | new, untracked |
| 3 | `.github/workflows/ci.yml` — **base blob at `f4d234b…`** | `97724c6ffb53df4389942b865bbd5c0f6c61a923` | unchanged reference |

**Any mismatch on any of the three is an immediate STOP** (§9), before staging and before
commit. Row 3 exists so that the purely additive character of the workflow change can be
re-proved without trusting the diff summary: the base blob must still be exactly
`97724c6f…`, and the working copy exactly `25e22c76…`.

Re-verified read-only alongside the hashes, and consistent with board §14.19.2: the `ci.yml`
diff against the base is **`66 insertions, 0 deletions`** in a single appended hunk, leaving
the base's **392 lines byte-identical** (458 lines total after the append); the appended
**`alert-context-route-db` job block carries `if: false` at job level** and self-labels
`STATIC CI WIRING, NOT WIRED`; **zero existing-job edits**. The new test module is **575
lines**.

## 5. Exact permitted mutation — Git index and one commit object, nothing else

**ZERO product byte edits are authorized.** No file in any product repository may be created,
modified, deleted, renamed, moved, reflowed or reformatted by this grant — including the two
paths being landed. The only permitted mutations anywhere in `cybrik-soc-command-center` are:

1. the **Git index** — `git add` of **exactly** the two §3.2 paths, after the §4 hashes verify
   and after the §7.2 pre-commit **GO**; and
2. **one** local **commit object** on `codex/w1-i03b-route-db-permanence-r1` with parent
   exactly `f4d234bba09ae1bea7a63b3348be3640a701065d`.

Not authorized, in any form: any byte change to either landed path or to any other path; any
third path; any `src/` edit; any conftest, fixture, migration, config or docs edit; any
deletion, rename or move; any dependency added, upgraded, removed or installed; any formatter
or auto-fixer run (including a scoped one); any amend, second commit, push, merge, remote
configuration, tag or release.

## 6. Classification duty — strictly static CI wiring, never "permanent" locally

Carried forward unchanged from the consumed grant §5, and binding on the writer, both reviews
and every downstream record:

- the appended CI job block is **strictly static CI wiring** — authored bytes only, hard-gated
  `if: false` at job level, with **CI: NOT WIRED** and **no CI result claimed**. It may never
  be described as permanent, wired, running, or green;
- the board §1.3 residual "the route-against-DB probe ran from `/tmp` and is **not** a
  permanent CI job" is **not closed** by this grant or by the authorized commit: **"permanent"
  requires push plus observed remote-green evidence**, and push/remote action stays `NO-GO`
  outside this grant;
- a completed, twice-reviewed commit counts **only** as local, independently reviewed,
  **unmerged and unpushed `SCAFFOLD`** evidence toward the **route-against-DB portion of
  live-shadow blocker 3**. The blocker's `shadow_remote` portion, its **real org mapping**
  portion, TTL enforcement and the live bundle path are untouched and stay open, so **blocker 3
  as a whole stands**.

## 7. Review and commit protocol — two fresh independent reviews, distinct reviewers

1. **Revalidate, then stop with zero staged.** The brand-new Opus 5 session first performs the
   §7.4 read-only revalidation, then **stops before staging** and reports, with **zero staged
   paths**. It does not stage and does not commit at this point.
2. **Fresh independent Fable pre-commit review.** A **fresh, independent Fable** session
   reviews the dirty tree. It must be **neither W0-R02B** (the cycle-1 dirty-tree reviewer)
   **nor W0-IR11** (this grant's governance reviewer), and neither of those reviews carries
   over. Staging and commit require an explicit **GO with no P0–P2** from this new review.
3. **One bounded local commit by the same new session.** After GO, the **same new Opus 5
   session** may resume **within its remaining §3.4 grant time only** to stage **exactly the
   two §3.2 paths** and make **exactly one** local commit (§5, §10). If its remaining time is
   zero, §2 applies — no other session may commit under this grant.
4. **Permitted read-only revalidation.** Only the following, none of which may write a product
   byte:
   - `git status`, `git diff`, `git diff --stat`/`--numstat`, `git show`, `git hash-object` —
     read-only Git inspection, including the §4 hash verification;
   - `ruff check` and `ruff format --check` only — **check modes only**, never `ruff format`
     and never `--fix`;
   - byte-compile of the new module;
   - the **skip-clean** run without `CYBRIK_TEST_DB=1`, whose expected result is **9 skipped**;
   - a **real PostgreSQL 16** run **only if it is available with no install and no image
     pull** — that is, using an **already-present local `postgres:16` image** and **one
     throwaway, test-only, no-egress container** that is **removed before the session ends**.
     **Absence of a database is explicitly NOT a STOP for this landing grant**: the bytes are
     hash-pinned and unchanged, so the cycle-1 recorded **9/9 GREEN** against PostgreSQL 16.14
     stands **as reported** at exactly those bytes and needs no re-execution to land them. If
     the DB is unavailable, the skip-clean result plus the §4 hash identity is the sufficient
     revalidation;
   - `mypy` and `actionlint` **only if already available** in the environment — **no install**,
     and their absence is not a STOP (see §8.2).

## 8. P3 dispositions — explicit, as the hard-stop record requires

The hard-stop record §6 makes resolution **or explicit disposition** of the three W0-R02B P3
findings a precondition of any future grant. All three are dispositioned here; none is
"resolved", because resolving any of them would require product byte edits that §5 forbids.

### 8.1 P3-1 — RED chronology: **ACCEPTED AS A PERMANENT EVIDENCE GAP**

The cycle-1 writer's transcript is unavailable, so the consumed grant's test-first requirement
— observed **RED** before **GREEN** — cannot be verified by citation. This is **accepted as a
permanent evidence gap**. It is **not** remediable under this grant and will not be remediated
later: the chronology **must never be reconstructed**, re-enacted, inferred or asserted after
the fact, and **no record may claim verified TDD or verified RED→GREEN** for this lane. The
RED→GREEN sequence rests on the cycle-1 writer's report alone and may be referred to **only as
reported**, always carrying the gap. The `SCAFFOLD` commit body must disclose it (§10).

### 8.2 P3-2 — `mypy`/`actionlint`: **RUN-IF-PRESENT, NO INSTALL; OTHERWISE OPEN CI DEFERRAL**

Both tools were unavailable in the cycle-1 environment, and no install is authorized here
either. Disposition: **run them if and only if they are already available**, with **no
install, no upgrade, no download**; record the result honestly. If they are unavailable, the
finding **remains open** as a deferral to CI — and **CI is NOT WIRED**, so the deferral is
open-ended and must be recorded as such rather than treated as satisfied. Absence is not a
STOP.

### 8.3 P3-3 — missing `cryptography`: **OUT OF SCOPE**

The runner lacks the `cryptography` package, producing a pre-existing, sandbox-only collection
failure — the `1 environment failure` in the cycle-1 backend slice. Disposition: **out of
scope**. It is pre-existing, outside this attempt's diff, and its only fix is a forbidden
install. The cycle-1 **available backend slice** figure (`2740 passed / 6 skipped / 1
environment failure`) therefore **retains that caveat** wherever it is cited, and the caveat may
not be dropped or rounded away.

### 8.4 New W0-IR11 P3 cosmetic observations — recorded, **not fixed**

The independent W0-IR11 review recorded three cosmetic P3 observations. All three are
**recorded and deliberately not fixed**: fixing any of them would be a product byte edit, which
§5 forbids and §9 makes a STOP.

1. **Non-English `noqa` comment fragment** at
   `services/api/tests/integration/test_alert_context_route_db.py` **line 97** — the `S608`
   suppression carries a non-English rationale fragment. Cosmetic only; the suppression itself
   is scoped to a module-constant identifier interpolation. (The base `ci.yml` already contains
   non-English comments outside this diff, at lines 249/253, so this is a pre-existing
   repository-wide style question, not a defect introduced here.)
2. **Import-time `os.environ.setdefault`** at the same file **line 78** — the module sets a
   test-only webhook-key default at import time rather than inside a fixture. Cosmetic and
   test-only; the value is a synthetic, throwaway, integration-only literal and no secret.
3. **`docs/operations/README.md` index omission** — that catalog indexes only the board, the
   register and the overnight handoff, so it omits this grant and every W1-I03B/W1-I07/W1-I06C
   grant and evidence record. `docs/operations/README.md` is **outside** the §14.20.1 control
   allowlist, so the omission **persists and is recorded, not silently fixed** — consistent
   with board §14.13.1–§14.19.1, which record the same residual.

## 9. STOP conditions — immediate hard stop, report partial evidence, then §2 applies

The writer and the resumed commit step must STOP immediately, with no further action, on any
of:

1. **any product file byte change** — any created, modified, deleted, renamed, moved,
   reflowed or reformatted file in any product repository, including either landed path;
2. **any hash mismatch** against the three §4 pins;
3. **any third path** dirty, or **any staged path** before the §7.3 staging step, or any
   hidden or residual staged content discovered at any point;
4. **any fix, formatter or auto-fixer** — including `ruff format`, any `--fix`, and any attempt
   to address the §8.4 cosmetic observations or the §8.1–§8.3 findings by editing bytes;
5. **any install or image pull** — dependency, package, driver, tool, container image or
   database install, upgrade or pull; likewise any `mypy`/`actionlint` install;
6. **any resumption of the exhausted session** `2aa3bab1-bf56-4161-ac04-b4f67810691c`, or any
   identity reuse or minting (including any "task 49") to obtain more time;
7. **observed state mismatch** — HEAD, branch tip or base ≠
   `f4d234bba09ae1bea7a63b3348be3640a701065d`; branch tip above base; not exactly two dirty
   paths; not zero staged at start;
8. **a pre-commit review outcome other than GO with no P0–P2**, or a pre-commit reviewer that
   is W0-R02B or W0-IR11;
9. **timeout** — the §3.4 runtime bound reached, or any prompt to request a second extension;
10. **any remote or promotion action** — any push, merge, remote configuration, tag, release,
    G2/G3 action, amend, second commit, date change, or any attempt to run or un-gate the CI
    job;
11. **any real data** — any non-synthetic tenant/org/alert/identity, any secret, any network
    egress; or any throwaway container left running at session end.

A STOP consumes this attempt's authority; it never widens the allowlist, never creates a
replacement identity, and never authorizes a further grant (§2).

## 10. The authorized commit — subject and required body classification

**Suggested subject, exact:**

```
test(soc): add alert-context route-DB test + gated CI block (SCAFFOLD)
```

The body must be status-honest and must state all of:

- **`SCAFFOLD`** classification — not `IMPLEMENTED`, `VERIFIED`, `PILOTED` or `GA`;
- the CI block is **static `if: false` CI wiring**: **CI NOT WIRED**, **no CI result claimed**;
- the **route-DB residual is not closed** and is **not** "permanent"; permanence requires
  **push plus observed remote green**, and **push is `NO-GO`**;
- **blocker 3 is not closed** — `shadow_remote`, real org mapping, TTL and the live bundle path
  stay open;
- the bytes were **authored under the exhausted cycle-1 grant and session** and are landed
  here **unmodified**, verified by the §4 hashes, under this landing grant;
- the **RED evidence gap** of §8.1 — the test-first chronology is **as reported only**, not
  verified.

Nothing is pushed. A **fresh, distinct, independent Fable post-commit review** follows, by a
reviewer that is none of W0-R02B, W0-IR11 or the §7.2 pre-commit reviewer. The commit becomes
product evidence **only after that post-commit review PASSes**, and then only as local,
independently reviewed, **unmerged/unpushed `SCAFFOLD`** evidence toward the route-against-DB
portion of blocker 3 (§6).

## 11. Forbidden claims and actions

Neither the writer, nor either review, nor any downstream record may claim or do any of:

- describing the CI job as **permanent**, **wired**, **running** or **green**, or claiming any
  CI result;
- **closure of the route-DB residual** or of **live-shadow blocker 3**, in whole or in part
  beyond the §6 local-`SCAFFOLD` classification;
- any claim about **`shadow_remote`**, a **real organization**, **TTL enforcement** or the
  **live bundle path** — all four are outside this grant and stay open;
- `IMPLEMENTED`, `VERIFIED`, `PILOTED` or `GA` status for anything in this lane;
- **verified TDD** or **verified RED→GREEN chronology** (§8.1);
- **push, merge, remote configuration, release, G2 or G3** action of any kind;
- any claim of **W0 completion** — `W0 COMPLETE=0` and W0 closure stays `NO-GO`;
- any **date change**: W1 formal dates **2026-08-01 → 2026-08-23**, all W0–W6 dates and the
  **2026-12-21 → 2026-12-31** release window are unchanged.

## 12. What this grant does not authorize

- **No push, no merge, no remote change, no release, no dependency install, no formatter.**
- **No product byte edit** anywhere, in any repository (§5) — this grant is index-and-commit
  only.
- **No `shadow_remote` work, no real org mapping, no TTL enforcement, no live bundle path** —
  those blocker-3 portions stay open and separately gated.
- **G2/G3 stay closed**; GATE A4 and W1-C1/C2 stay `ACCEPTED — CLOSED 2026-07-26`; W1-G1 stays
  `ACCEPTED — CLOSED 2026-07-27`; W1 integration/live shadow stays `HOLD`/`NO-GO`;
  `W0 COMPLETE=0` and W0 closure stays `NO-GO`; the board §11 exit criteria remain unmet.
- **No status promotion:** the resulting commit, if any, carries `SCAFFOLD` status honesty and
  becomes product evidence only after the §10 post-commit review passes; no gate in board §1
  moves on this grant alone.
- **No third grant** for this landing scope, and no disposal or W1-window folding of the tree
  (§2) — both require an explicit Founder decision.
- The Fabric W0-I07 and Cyber AI W0-I06 lanes (board §1.7, §1.9) are untouched by this grant.

## 13. Provenance

- Bounded grant-authoring authority and control-side measured evidence: board §14.20 (allowlist
  §14.20.1; basis evidence §14.20.2; measured evidence §14.20.4, including the roadmap hash
  pin); board summary §1.12.
- Matching register entry: `docs/operations/W1-E2-EVIDENCE-REGISTER.md` §15.
- The consumed cycle-1 grant and its outcome, both standing **unedited** as dated history:
  `docs/operations/W1-I03B-ROUTE-DB-PERMANENCE-GRANT.md` (board §1.10/§14.18; register §13) and
  `docs/operations/W1-I03B-ROUTE-DB-HARD-STOP-EVIDENCE.md` (board §1.11/§14.19; register §14).
- Prior dated records of the lane and its residuals: board §1.3/§14.11 (SOC runtime-evidence
  reconciliation, blockers list); register §6.
- Governance-pattern precedent only, per §1.2: Fabric W0-I07 (board §1.6/§1.7; register
  §9/§10) and Cyber AI W1-I06C (board §1.8/§1.9; register §11/§12).
- The reviewed base this lane builds on: commit `f4d234b…`, W0-R02 re-review `PASS`.
