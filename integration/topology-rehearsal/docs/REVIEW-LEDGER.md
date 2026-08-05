# Review Ledger — `topology-rehearsal`

Status: `DRAFT`

Durable in-repo record of independent-review verdicts for branch
`codex/uat-browser-g-u2b-db-red-gate-r1`, component `integration/topology-rehearsal/`.

This file is static-evidence bookkeeping only. No runtime, Docker, or UAT
execution has occurred against this component. RUNTIME remains **HOLD** for
every range below, regardless of PUSH-ELIGIBLE outcome.

**How to use this file:** before pushing any change in this component, the
independent reviewer appends a new row/section below recording the commit
range, verdict, P0/P1/P2/P3 counts, PUSH-ELIGIBLE decision, and any open
findings — in that order, before the push happens. Do not push first and
backfill later; that is exactly the gap that caused a prior cycle's six P3s
to be lost irrecoverably.

## Verdict history

| Range | Subject | Verdict | P0/P1/P2/P3 | Push-eligible | Runtime |
|---|---|---|---|---|---|
| `e85c235..1050684` | Admission | GO | 0/0/0/2 | YES | HOLD |
| `030926c..a4dba72` | Docker adapter platform normalization (4 commits) | GO | 0/0/0/4 | YES | HOLD |
| `a4dba72..7ed7702` | Runner, first review | NO-GO | 0/1/1/6 | NO | HOLD |
| `a4dba72..d6c0d47` | Runner, second review + independent security verification | NO-GO / security FAIL | 0/3/1/0 | NO | HOLD |
| `73ec822..69ed068` | Entrypoint wiring RED chain + adapter plan accessor (5 commits) | NO-GO | 1/2/4/2 | NO | HOLD |

## Range detail

### `e85c235..1050684` — Admission

Independent Opus review. VERDICT GO. P0=0 P1=0 P2=0 P3=2. PUSH-ELIGIBLE YES.
RUNTIME HOLD. Pushed to draft PR #55.

Open P3s (unresolved as of this writing):
1. Missing and explicit-`None` projections share a refusal message.
2. The composition module must document and enforce how it derives every
   `GrantFacts` member independently.

### `030926c..a4dba72` — Docker adapter platform normalization

4 commits (`030926c`, `90d8564`, `7c6410d`, `a4dba72`). Independent Opus
review. VERDICT GO. P0=0 P1=0 P2=0 P3=4. PUSH-ELIGIBLE YES. RUNTIME HOLD.
Pushed.

Evidence recorded at review time: focused suites 835 passed; broad census
1308 passed / 74 intentional RED; `adapter.py` 799 lines; `observe.py` 506
lines; ruff clean; contract validator exit 0.

Note: intermediate commit `7c6410d` recorded a census of "1307 passed, 75
failed" that was inaccurate — one of those 75 was a real 805-line
surface-contract violation, corrected by `a4dba72`. The 4-commit range above
is the corrected, reviewed state.

### `a4dba72..7ed7702` — Runner, first review

VERDICT NO-GO. P0=0 P1=1 P2=1 P3=6. PUSH-ELIGIBLE NO. RUNTIME HOLD.

**Process failure:** the six P3 findings from this review were never
durably recorded anywhere in-repo and are now unrecoverable. They are not
reproduced here because reconstructing them from memory would risk
overstating or inventing findings that were never actually verified. This
loss is the direct motivation for this ledger's existence.

### `a4dba72..d6c0d47` — Runner, second review + independent security verification

VERDICT NO-GO / security FAIL. P0=0. PUSH-ELIGIBLE NO. RUNTIME HOLD.

Consolidated open blockers at time of this review:

- **P1** — `_guarded_clock` shape check sits outside its `try`
  (`runner.py:544`); a huge-`int` reading raises `OverflowError` from
  `isfinite()`, escaping after ledger consumption and five creates with
  zero teardown.
- **P1** — one `try` wraps all four teardown removals
  (`runner.py:437-443`), so a failing container removal abandons the
  remaining removals including the on-disk credential (mode 0600 secret
  material) — orphaned secret material on the host.
- **P1** — post-teardown residual observations (`runner.py:452-454`) are
  unguarded and escape the whole function, burning the single-use ledger
  entry with no result and no evidence.
- **P2** — a backwards clock (`completed < started`) yields a falsely
  clean `TOPOLOGY_PASS`; `runner.py` contains no `finally` block anywhere,
  so mandatory teardown is guaranteed only by every individual call between
  consume and teardown being separately guarded — fragile, and the direct
  cause of this recurring defect class.

Verified-good and to be preserved (not blockers):

- Nine-field anti-self-witnessing `GrantFacts` composition
  (`prepared.selected_image_identity` provably never read; fact 6
  reassembled from `prepared.image` + `PULL_POLICY`).
- Outcome precedence.
- Single-consume / five-create lifecycle.
- No runtime reachability: zero subprocess/socket/Docker-SDK imports in
  `src/`; `adapters` a required positional with no default;
  `execute_requested is not True` identity check.
- Secrets clean.
- 800-line budget.
- conftest runtime tripwire.

Known gate gap: branch coverage cannot currently be evidenced for this
component — Coverage.py is neither installed nor declared here, and
installing it is Founder-gated.

As of `d6c0d47` (the HEAD at the time that review was written), these
blockers had not yet been re-reviewed and closed. They are closed by the
range recorded in the next section.

### `a4dba72..0b6c118` — Runner, third review

11 commits. Independent Opus review, read-only, of the whole range.
VERDICT GO. P0=0 P1=0 P2=0 P3=4. PUSH-ELIGIBLE YES. RUNTIME HOLD.

All four blockers from the second review above are closed and pinned by
tests: the finiteness question is now asked inside `_guarded_clock`'s guard,
each teardown removal and each post-teardown residual read is separately
guarded, and a completion reading earlier than its opening reading is
escalated to `STOP_CONTROL` instead of reaching a clean `TOPOLOGY_PASS`.
The nine-field anti-self-witnessing composition is preserved and is now
enforced structurally by an AST test, not by substring.

Evidence recorded at review time: `tests/test_runner.py` 75 passed; broad
census 1390 passed / 29 failed, and all 29 are the intentional RED for the
two absent entrypoint scripts (22 in `test_scripts_inert.py`, 7 in
`test_surface_contract.py`), with no failure anywhere else; `runner.py` 725
lines and every authored module under the 800-line bound; `ruff check src`
clean; `python -m compileall src` clean; contract validator exit 0.

Open P3 findings carried forward (none blocking):

- **P3** — in `_teardown`, bound methods are resolved as argument
  expressions outside the `try` that guards them, so a raising attribute
  lookup would still escape. Unreachable today because every port is
  isinstance-checked pre-consumption. Repair: resolve with `getattr` inside
  the guard.
- **P3** — `_observed_names` renders untrusted residual/listener values with
  `f"{item}"` outside every guard; an item with a raising `__str__` would
  escape.
- **P3** — `resolve_outcome` and `_evidence` run post-teardown unguarded.
  Statically unreachable; tripwire placement only.
- **P3** — a residual read that itself raises reports `residuals == ()`,
  indistinguishable from "no residue" unless `teardown_complete` is read
  with it.

The six P3 findings from the first review remain unrecoverable, as recorded
above. Of the two admission P3s, the composition-documentation item is
closed by `runner.py`'s module docstring plus the AST test; the shared
refusal message for missing versus explicit-`None` projections stays open.

Known gate gap, unchanged: branch coverage still cannot be evidenced for
this component. Coverage.py is neither installed nor declared here, no
alternate venv or vendored copy can produce it, no CI workflow measures it,
and the prior Coverage.py authorizations were one-time, already consumed,
and scoped to a different component. Closing this gate requires a new
Founder decision.

### `73ec822..69ed068` — Entrypoint wiring RED chain + adapter plan accessor

Independent Opus review. VERDICT NO-GO. P0=1 P1=2 P2=4 P3=2. PUSH-ELIGIBLE NO.
RUNTIME HOLD.

**The individual findings of this review were not written down before the
reviewing cycle ended, and are unrecoverable.** This is the second time this
component has lost a finding list that way; the first was the six P3s of the
Runner's first review. What can be reconstructed is only what the three
following commits claim to correct, and each claim is the commit's own, not the
reviewer's words:

- `6bc0745` withdraws `aae6a30`'s requirement that every command adapter publish
  the raw process executor by identity, recording that review refuted the
  security framing but sustained it as a layering defect — a holder of the
  frozen `Adapters` bundle could reach `adapters.docker.runner.run(argv, ...)`
  and walk past the plan-membership guard at `adapter.py:250`. Plausibly the P0.
- `a5307cc` and `3cd9d77` refute the envelope answer for `repository_roots` and
  replace it with mandatory caller injection.

Treat the above as provenance, not as a discharge. Nothing here proves the
review's P0/P1/P2 are closed, and the counts stay open until a fresh independent
review of the full local range says otherwise.

### `73ec822..3cd9d77` — the same chain plus the injection correction

Live static evidence re-measured at `3cd9d77` (this is measurement, not a
verdict; the independent review of this range was still running when the cycle
ended):

- Broad census: `1395 passed, 48 failed`. All 48 carry the identical
  `missing C8 implementation ... does not exist` message for
  `scripts/prepare_topology_grant.py`, `scripts/run_topology_rehearsal.py` and
  the absent `scripts/` directory — 41 in `tests/test_scripts_inert.py`, 7 in
  `tests/test_surface_contract.py`. No failure anywhere else.
- `tests/test_adapter.py`, `test_runner.py`, `test_admission.py`,
  `test_preparation.py`, `test_plan.py`: 901 passed, 0 failed.
- `python -m compileall src` clean; contract validator exit 0, ALL GREEN.
- No authored module reaches the 800-line bound: `adapter.py` 799,
  `preparation.py` 798, `grant.py` 794, `runner.py` and `admission.py` 725 each.
- The diff touches nothing outside `integration/topology-rehearsal/`.
- **Gate gap:** `ruff` is not installed in this component's `.venv`; the
  `.venv/bin/ruff` and `python -m ruff` gates could not run. A system `ruff` at
  `/opt/homebrew/bin/ruff` reports all checks passed on `src`, but that is a
  different binary at an unpinned version and is recorded as a fallback, not as
  the gate.

Open blocker found this cycle, independent of the pending review: the corrected
injection contract stops one seam short of the composition root and pins a
default path that can only raise `TypeError`. See obstacle 4 in
`ENTRYPOINT-SLICE-SPEC.md`. The next commit on this slice is a further tests-only
RED carrying the injection up to `main`'s argv boundary.

## Open non-technical items for the Founder

- `integration/topology-rehearsal/uv.lock` is untracked and un-ignored in
  this worktree, pending a dependency decision. See repo-root `CLAUDE.md`:
  dependency installation is Founder-gated.

## Ledger maintenance

Append new rows/sections above rather than editing prior ones, except to
fix factual errors. Do not relabel any past verdict as IMPLEMENTED,
VERIFIED, or GA — this ledger records review verdicts on code, not
runtime or production status.
