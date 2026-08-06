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
| `73ec822..3cd9d77` | Same chain + mandatory root injection (6 commits) | NO-GO | 1/2/4/2 | NO | HOLD |

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

The independent Opus review of this range then returned: **VERDICT NO-GO,
P0=1 P1=2 P2=4 P3=2, PUSH-ELIGIBLE NO, RUNTIME HOLD.** Every finding is written
out below before anything else happens, because this component has already lost
two finding lists that way.

**P0 — the composition root is pinned to a call shape the real builder can never
accept, so no GREEN exists.** Three assertions in `test_scripts_inert.py` are
mutually unsatisfiable: `:218` pins the builder call as `build(*, authorization)`
and compares an exact `calls` list; `:251` pins
`dependencies.wiring_builder is build_runtime_wiring` by identity, which excludes
`functools.partial`; `:713-726` pins `repository_roots` keyword-only with
`default is inspect.Parameter.empty`. Demonstrated under the venv: the one-keyword
call succeeds on the fake and raises `TypeError` on the real function; the
two-keyword call does the reverse. `git show 73ec822:tests/test_scripts_inert.py`
confirms the fake already had this shape at origin, so **`3cd9d77` introduced the
contradiction rather than inheriting it**. This is the same defect recorded
independently as obstacle 4.

**P1 — the self-witnessing AST guard is scoped to one function and simultaneously
forbids the only read that makes the wiring implementable.**
`test_the_wiring_never_reads_the_grant_or_the_host_for_a_control_root`
(`:869-889`) inspects `inspect.getsource(build_runtime_wiring)` alone, so a helper
reading `os.environ` passes every assertion. Worse, it is self-defeating: the
review exhausted every envelope field for the attempt instant
`20260805T000000Z-c8` and found it reachable **only** through
`authorization.grant["observed_image_identity"]["observed_at"]` or
`grant["window"]["not_before"]`. `authorization.observed_at` is `00:01:00Z`,
`record["recorded_at"]` is `00:00:30Z`, and `record["topology"]["image"]` carries
no such key. So the wiring must read `.grant`, while `:879` bans the name `grant`
and `:889` bans `getattr`. The only route to GREEN is a helper whose body does the
banned read — leaving a control whose docstring claims the derivation is wholly
inside `build_runtime_wiring` while it demonstrably is not. Repair is either an
AST walk over the whole module with an allow-list for the grant reads the plan
genuinely needs, or moving the derivation into a reviewed `src` module and
narrowing this test to "no *root* is derived", dropping a blanket `grant` ban that
has nothing to do with roots.

**P1 — `runner.py:299-300`: the attempt identity is fixed at composition time from
the grant's pinned instant, but the runtime derives it from the live host
observation, which the code requires to be no earlier.** `_attempt_names` computes
`attempt_id` from `prepared.image[OBSERVED_AT_KEY]`, and `prepared.image` is the
live observation (`preparation.py:740`), which `preparation.py:613-616` requires to
be at or after the grant pin. The wiring must build its plan before any observation
exists, so its `container_name`/`network_name`/`volume_name` embed the grant's
instant. On any real run where the host is observed even one second later, the
names differ, `require_exact` rejects the create, and the attempt returns
`"creation: raised …"` — fails closed, but **always, on every real execution**. It
is GREEN today only because the fixture host observation and
`documents.IMAGE_OBSERVED_AT` are the same string. This is a latent defect in
already-pushed code, not in this range. Repair: build the plan in two stages, or
publish a plan factory the runner completes with `names.attempt_id`.
`tests/test_runner.py` has no case where the live `observed_at` is strictly later
than the grant pin; it needs one.

**P2 — `wiring.command_runner` publishes the raw executor** (`:439, :476, :612,
:915`), so the "no unguarded process seam" property holds for adapters only. Any
holder of the wiring can call it with arbitrary argv and bypass
`ExactCommandAdapter.run_effect`. Contained today only because
`execute_authorized_attempt` passes `wiring.adapters`, never the wiring — and that
containment is unpinned.

**P2 — the publication walk cannot see private names** (`:509-526`):
`published_names` skips `_`-prefixed names and the walk is two levels deep, so
`wiring.command_adapters["docker"]._executor._runner.run([...])` stays fully
reachable while the test reports zero publications. The docstring at `:582-609`
states the property as absolute; what is checked is "no *public* path".

**P2 — `test_entrypoint_surface_is_bounded` (`:286-302`) pins `__all__`, not the
module's public namespace.** `__all__` governs `from x import *` only, so a
module-level `resolve_control_roots` omitted from it is still importable and
callable — while the comment at `:291-294` asserts its absence *is* the contract.
Combined with the P1 above, a future implementation could ship a public
host-observing helper no test in this file can see.

**P2 — `CommandAdapterAccessors` sits in `observe.py` to keep `adapter.py` at 799
lines** (`observe.py:508-542`). `69ed068`'s message and the class docstring both
give the line count as the reason. `observe.py` is documented as pure
decoders/reducers; an adapter mixin is not one, and the class is kept out of
`__all__` to paper over that. Splitting by line count rather than cohesion defeats
what the bound is for. Repair: put the accessor with the adapters and reclaim the
lines by extracting a genuinely cohesive block instead.

**P3 — absent roots raise `TypeError` while `None` roots raise `PrecheckAbort`**
(`:713-726` vs `:788-820`), two refusal types for one class of operator mistake,
against the file's stated "one typed refusal naming the parameter" principle.

**P3 — `ruff check tests` reports 2 × I001** (`test_errors.py:12`,
`test_runner.py:3`), pre-existing and outside this range. Repair in a separate
chore commit — **not** with `--fix`, since formatters and auto-fixers are
Founder-gated by the repo `CLAUDE.md`.

What the review confirmed as genuinely closed: the RED is honest (all 41
`test_scripts_inert.py` failures are the absent-script class, zero assertion
failures), and `6bc0745` + `69ed068` completely withdrew the executor publication
— `grep` finds no public callable process seam on any adapter, and the fixture-leak
trap of prior cycles is closed, since no synthetic literal is needed anywhere.

### `73ec822..76553f4` — Entrypoint slice, measured evidence at the full local range

Measured at HEAD `76553f4` (11 commits ahead of the pushed PR #55 tip `73ec822`),
before any verdict. This section records **evidence only**; the independent
verdict for this range is recorded separately below it and is not implied here.

Broad static census: **1395 passed / 49 failed**. Every one of the 49 failures is
the intended absent-entrypoint class, with no assertion failure and no error of
any other kind:

- 40 × `scripts/run_topology_rehearsal.py does not exist`
- 8 × `scripts/prepare_topology_grant.py does not exist`
- 1 × `scripts/ does not exist`

All 49 are confined to `tests/test_scripts_inert.py` (42) and
`tests/test_surface_contract.py` (7). `scripts/` is absent on disk, as intended.
The count moved from 48 at `3cd9d77` to 49 at `76553f4` because `015de49` added
`test_the_control_roots_are_mandatory_at_the_composition_root_as_well`.

Other static evidence at this HEAD:

- `python -m compileall src tests` — OK.
- `git diff --check 73ec822..HEAD` — clean.
- `ruff check src tests` — 2 × `I001`, both **pre-existing and outside this
  range** (`tests/test_errors.py:12`, `tests/test_runner.py:3`; neither file is
  touched by these 11 commits). Not repaired here: `--fix` is a Founder-gated
  auto-fixer under the repo `CLAUDE.md`. This is the same P3 already recorded
  for `73ec822..3cd9d77`, unchanged.
- File sizes against the 800-line bound: `adapter.py` 799, `preparation.py` 798,
  `grant.py` 794, `runner.py` 725, `admission.py` 725, `observe.py` 542. The
  adapter headroom of one line is unchanged by this range and remains the
  structural constraint the spec's obstacle 1 turns on.

Coordinator's independent read of the range's central claim, recorded so the
verdict can be checked against it rather than restating it: `015de49` moves the
control-root injection to the argv boundary (`--control-root NAME=PATH`,
repeatable, accumulating, mandatory, no default). `grep` confirms
`fakes.SYNTHETIC_REPOSITORY_ROOTS` is referenced only from `tests/`, never from
`src/`. That is the structural reason the prior range's P0 — that the wiring
assertion could only be satisfied by writing the fixture path `/synthetic/<name>`
into production source — no longer has a mechanism. Whether it is *fully*
discharged is the independent reviewer's call, not this section's.

RUNTIME remains **HOLD**. Neither entrypoint script was executed; nothing in this
range was run beyond the static pytest suite.

## Open non-technical items for the Founder

- `integration/topology-rehearsal/uv.lock` is untracked and un-ignored in
  this worktree, pending a dependency decision. See repo-root `CLAUDE.md`:
  dependency installation is Founder-gated.

## Ledger maintenance

Append new rows/sections above rather than editing prior ones, except to
fix factual errors. Do not relabel any past verdict as IMPLEMENTED,
VERIFIED, or GA — this ledger records review verdicts on code, not
runtime or production status.
