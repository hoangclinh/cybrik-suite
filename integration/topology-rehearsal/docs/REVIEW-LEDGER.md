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
| `73ec822..76553f4` | Entrypoint slice, full local range (11 commits) | NO-GO | 0/5/8/4 | NO | HOLD |
| `817227b..a1a97f6` | F3 repair (module-wide root-derivation ban) | NO-GO | 0/2/3/2 | NO | HOLD |

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

### `73ec822..76553f4` — Entrypoint slice, independent review

Independent Opus review, adversarial, reviewer did not author the range.
**VERDICT NO-GO. P0=0 P1=5 P2=8 P3=4. PUSH-ELIGIBLE NO. RUNTIME HOLD.**

The reviewer independently reproduced the census above (1395/49, all absent-script
class) and re-derived every src line count before judging.

**Blocking set for GO: F1, F2, F3, F4.** F5 blocks any future runtime GREEN but
does not block this static slice on its own.

#### Disposition of the `73ec822..3cd9d77` findings

| Prior finding | Status | Evidence |
|---|---|---|
| P0 composition root pinned to a call shape the real builder can never accept | **DISCHARGED** | `test_scripts_inert.py:287` fake is now `def build(*, authorization, repository_roots)`; `:351`/`:392` lambdas match; `:330-341` pins the mandatory keyword-only `repository_roots`; `:241` forwards from `main`. The set is satisfiable end to end; `015de49`'s central claim holds. |
| P1 self-witnessing AST guard scoped to one function, bans the only implementable read | STILL OPEN | `:998-1016` unchanged — see F3 |
| P1 `runner.py:299-300` attempt identity fixed from the grant pin | STILL OPEN | no commit in range touches `runner.py` — see F5 |
| P2 `wiring.command_runner` publishes the raw executor | STILL OPEN | `:565`, `:603`, `:740`, `:1042` — see F9 |
| P2 publication walk cannot see private names | STILL OPEN | `published_names` at `:653` still filters `_`-prefixed — see F8 |
| P2 `test_entrypoint_surface_is_bounded` pins `__all__`, not the namespace | **STILL OPEN, WIDENED** | `:429`; new comment `:414-421` now rests the bound on unenforced privacy — see F10 |
| P2 `CommandAdapterAccessors` sited in `observe.py` by line count | STILL OPEN | `observe.py:509-542` — see F11 |
| P3 two refusal types for one operator mistake | **STILL OPEN, WORSENED** | now three sites — see F14 |
| P3 `ruff` 2×I001 | STILL OPEN | out of range — see F15 |

Note: the finding loss recorded in `2b864e3` was itself repaired by `42bc6f7`;
the prior detail is recoverable in full from this file at `:212-296`.

#### Findings

**F1 — P1 — `tests/test_scripts_inert.py:1027-1042` — the single-shared-executor
control was deleted on the default path and never replaced.** At `73ec822`,
`test_runtime_wiring_defaults_to_the_single_subprocess_executor` ended with
`assert wiring.command_adapters[name].runner is wiring.command_runner` for every
name. `6bc0745` removed it; the body now asserts only `isinstance(...)`. Its
stated replacement (`:580`) only ever exercises an *injected* `LedgerRunner`, as
do `:565` and `:739`. Failure: `build_runtime_wiring(...)` with
`command_runner=None` may construct `SubprocessCommandRunner()` five times, one
per adapter, plus a sixth as `wiring.command_runner`, and every test still
passes — the AST single-spawn-site control at `:432` counts spawn *sites* in one
class's source, not executor *instances*. The file's own rationale at `:585-587`
is unproven on the only path an operator runs. Fix: AST-walk
`inspect.getsource(build_runtime_wiring)` and assert exactly one
`SubprocessCommandRunner` call node.

**F2 — P1 — `tests/test_scripts_inert.py` (whole file) — `015de49` delivers 1 of
the 6 test additions its own adjudication owed; the argv-shape refusal band has
zero tests.** `ENTRYPOINT-SLICE-SPEC.md:360-366` names six additions;
`git diff 42bc6f7..015de49` adds exactly one. Missing: hold when roots are
unstated, hold on each malformed token, a typed `PrecheckAbort` converted to
`HOLD_EXIT`, and the single-validation-site property. Failure:
`main(["--execute","--grant","/tmp/g","--signature","/tmp/g.sig"])` with no
`--control-root` may legally fold to `{}` and reach `execute(...)`, which reads
both artifact files before the refusal — precisely the ordering the docstring at
`:326-327` claims is forbidden. Fix: add the unstated-roots test with a recording
`execute=` asserted never called, plus a parametrized malformed-token test over
`--control-root novalue`, `=/p`, `n=`, and a repeated name.

**F3 — P1 — `tests/test_scripts_inert.py:998-1016` — the anti-self-witnessing
guard forbids the only read that makes the wiring buildable, so the sole route to
GREEN is a helper performing the banned read.** `:1006` bans `grant` in
`inspect.getsource(build_runtime_wiring)` and `:1016` bans `getattr`, but `:567`
requires `wiring.plan.commands == built_plan().commands` with
`attempt_id="20260805T000000Z-c8"`. The reviewer exhausted the envelope:
`observed_at` is `00:01:00Z` (`documents.py:216`), `recorded_at` is `00:00:30Z`
(`documents.py:47`), the image carries no instant (`documents.py:143-144`). The
string is reachable only via `grant["observed_image_identity"]["observed_at"]`
(`fakes.py:85`) or `grant["window"]["not_before"]` (`documents.py:44`), and
`SYNTHETIC_ATTEMPT_ID` is in `fakes.SYNTHETIC_VALUES` (`fakes.py:233`) so it
cannot be inlined. The implementation is *forced* into a module-level helper the
guard cannot see, while the guard's docstring claims the derivation is wholly
inside `build_runtime_wiring`. Fix: narrow `:1006` to the host-observation set
and replace the blanket `grant` ban with a whole-module AST walk asserting no
*root* value derives from `grant` — the ban has nothing to do with roots.

**F4 — P1 — `docs/ENTRYPOINT-SLICE-SPEC.md:53-78` — the normative contract
section still states the exact shape its own later sections refuted.** Five
disagreements with the tests the file claims derivation from: `:55` omits
`--control-root`; `:57-58` says `main` calls `execute(args.grant,
args.signature)` positionally; `:60-61` omits the mandatory `repository_roots`;
`:64` is the literal call shape `42bc6f7` adjudicated unsatisfiable; `:73` omits
`repository_roots` from `build_runtime_wiring`. `76553f4` corrected the owed-edit
list but left the section an implementer reads first. The "tests win" clause at
`:9-10` is a disclaimer, not a control. Fix: rewrite `:53-78` to the argv-boundary
shape, or move it under a `SUPERSEDED` banner.

**F5 — P1 — `src/…/runner.py:299-300` vs `tests/test_scripts_inert.py:567` — the
composition root is pinned to build a plan whose resource names no real run can
match.** `_attempt_names` computes `attempt_id` from the *live*
`prepared.image[OBSERVED_AT_KEY]`, which `preparation.py` requires to be at or
after the grant pin; `build_runtime_wiring` must build the whole plan before any
observation exists, so the names embed the grant's pinned instant. Failure: on any
real host observed even one second later, `require_exact` rejects the create and
the attempt returns `"creation: raised …"` — fails closed, but on *every* real
execution. Green today only because `fakes.IMAGE_OBSERVED_AT` equals the grant
pin. Out of range, but this range re-affirms the pin at `:567`. Fix: two-stage
plan construction or a plan factory the runner completes with `names.attempt_id`;
add a strictly-later `observed_at` case to `test_runner.py`.

**F6 — P2 — `tests/test_scripts_inert.py:356-362` — the behavioural half of the
new mandatory-roots test cannot fail.** Given `:333` keyword-only, `:334` no
default and `:341` no variadic already passed, CPython raises during argument
binding before the body runs, so the trailing `assert loaded == []` is guaranteed
by the language while the docstring presents it as a fail-before-read control.
Fix: delete the vacuous half; state the property at the argv band (F2).

**F7 — P2 — `docs/ENTRYPOINT-SLICE-SPEC.md:473-475` — owed-path item 4 is
materially incomplete and its "nothing else in that file weakens" is wrong.**
`FRONT_DOOR_ABSENT_MODULES = ()` already (`:77`), so once the scripts land
nothing in the component is absent — yet `:176` requires
`FRONT_DOOR_ABSENCE_CLAIM` to appear and `:226` requires exactly one sentence to
carry it, a sentence `:229` forbids from naming any present module and `:231`'s
move forbids from naming the scripts. The only satisfying docstring carries a
sentence about nothing. Removing a front-door absence control *is* a weakening the
list denies. Fix: extend item 4 to name `FRONT_DOOR_ABSENCE_CLAIM` (`:73`), `:176`
and `:226-231`, and state what replaces the absence sentence.

**F8 — P2 — `tests/test_scripts_inert.py:709-753` + `:636-653` — the "no public
path to the executor" claim is absolute but checked only over public names.**
`wiring.command_adapters["docker"]._executor._runner.run(argv, …)` stays reachable
while the test reports zero publications. Fix: state it as "no *public* path", or
walk private names and allow-list `_executor._runner`.

**F9 — P2 — `tests/test_scripts_inert.py:565, 603, 740, 1042` —
`wiring.command_runner` still publishes the raw executor.** Any wiring holder
calls it with arbitrary argv, bypassing `ExactCommandAdapter.run_effect`.
Contained only because `execute_authorized_attempt` passes `wiring.adapters`,
never the wiring — and that containment is unpinned. Fix: assert the object handed
to `runner` is `wiring.adapters` and that no argument is the wiring itself.

**F10 — P2 — `tests/test_scripts_inert.py:414-421` — the new `__all__` comment
rests the surface bound on privacy no test enforces.** The comment asserts as
contract that `_control_root_pair`/`_control_roots` "are private and observe
nothing"; neither half is checked, and the spec at `:378-380` records they sit
outside the AST guard. Failure: a public `resolve_control_roots` reading
`os.environ` ships, absent from `__all__`, unseen. Fix: assert the public
namespace is a subset of the expected set, and extend the AST guard to every
module-level `_control_root*` function.

**F11 — P2 — `src/…/observe.py:509-542` — `CommandAdapterAccessors` is sited by
line count, not cohesion.** The docstring still gives the 800-line bound as the
reason; `observe.py:6-7` declares pure decoders/reducers, and the class is kept
out of `__all__` to paper over the mismatch. Fix: move to `adapter.py` and reclaim
lines by extracting a cohesive block.

**F12 — P2 — `docs/ENTRYPOINT-SLICE-SPEC.md:80-89` — obstacle 1 still describes
the withdrawn `.runner` accessor as required**, false since `6bc0745`/`69ed068`;
`tests/test_adapter.py:151` now asserts `not hasattr(instance, "runner")`. The
heading "Three obstacles found" stands while four are documented.

**F13 — P2 — `tests/test_scripts_inert.py` — no negative case pins that `main`
refuses to execute when `--execute` is absent.** An implementation ignoring
`args.execute` and always calling the executor passes every test in the file; the
`execute_requested=True` literal at `:292` is asserted *inside* the execute path,
never as a gate on entering it. Pre-existing, but this range restructured `main`'s
argv handling without adding it.

**F14 — P3 — `tests/test_scripts_inert.py:356`, `:852`, `:939` — one operator
mistake, three refusal spellings** (`TypeError`, `TypeError`, `PrecheckAbort`)
against the file's own principle at `:924`.

**F15 — P3 — `.venv/bin/` has no `ruff`, so the lint gate did not run as
claimed.** `015de49`'s message claims `ruff check … clean` without naming the
binary; only an unpinned system `ruff` exists. The two `I001` remain, out of
range, Founder-gated to repair.

**F16 — P3 — `src/…/adapter.py` is 799 against a strict `< 800` bound**
(`test_surface_contract.py:95, 246`). Nothing breaches, but that one line of
headroom is what decided F11's siting, and the spec notes
`scripts/run_topology_rehearsal.py` must also land under the bound.

**F17 — P3 — `ENTRYPOINT-SLICE-SPEC.md:328-329` says `argparse-required
--control-root`** while `tests/test_scripts_inert.py:199-205` explicitly declines
to pin required-ness at the parser and permits either spelling.

#### What the review confirmed as sound

The RED is honest (49 failures, all absent-script, zero assertion failures). No
synthetic fixture value can reach `src/`; the prior P0's structural cause is gone.
`6bc0745` + `69ed068` are a net **strengthening** — the executor publication is
fully withdrawn and `test_adapter.py:151` pins its absence across the whole MRO.
No status-honesty violation; every banner is correctly hedged. The diff touches
nothing outside `integration/topology-rehearsal/`, weakens no src file, and leaves
the size bound, inventory, single-spawn-site AST control and `forbid_real_io`
tripwire intact.

### `bef383c..f6622d4` — F1 repair, measured evidence

One commit, tests only, repairing exactly one recorded finding: **F1 (P1)**, the
single-shared-executor control deleted from the default path by `6bc0745`. F2,
F3 and F4 are deliberately untouched and the `73ec822..bef383c` range remains
**NO-GO / PUSH-ELIGIBLE NO**. Repairing one finding per cycle keeps each repair
independently reviewable; it is not a claim that the others are discharged.

What landed, in `tests/test_scripts_inert.py` only:

- `test_the_default_execute_path_constructs_exactly_one_process_executor` states
  the missing half structurally rather than by identity, so it republishes
  nothing: exactly one `SubprocessCommandRunner` call node in the whole script,
  that node owned by `build_runtime_wiring` rather than a private helper, and not
  nested in a loop, comprehension or inner `def`.
- the docstring of `test_runtime_wiring_defaults_to_the_single_subprocess_executor`
  no longer claims the injected-runner routing test proves the default path; it
  now names which test proves which path.

Effectiveness evidence — the control is not vacuous. It was run offline against
four synthetic composition roots in `/tmp` (scratch only; nothing was added to
the repository for it). It **admits** the one-shared-executor shape and
**refuses** all three defect shapes:

| Synthetic composition root | Control | Refused by |
|---|---|---|
| one executor, shared by all five adapters | passes | — |
| five built in a loop (F1's exact scenario) | refused | module count |
| built in a private helper, called twice | refused | builder count |
| two construction sites in one function | refused | module count |

Static evidence at `f6622d4`:

- Broad census: **1395 passed / 50 failed**, moved from 49 by exactly this one
  new test. All 50 are the intended absent-script class — `pytest --tb=line`
  yields `does not exist` for every one, with zero assertion failures and zero
  errors of any other kind.
- `python -m compileall tests/test_scripts_inert.py` — OK.
- `git diff --check` — clean.
- `ruff check tests/test_scripts_inert.py` — clean. The binary is still the
  unpinned system one, so **F15 stands unchanged**; this is not a claim that the
  pinned lint gate ran.

Neither entrypoint script was executed. No `src/`, docs, dependency or lockfile
change. RUNTIME remains **HOLD**.

### `f6622d4..4230858` — F2 repair, measured evidence

One commit, tests only, repairing exactly one recorded finding: **F2 (P1)**, the
argv-shape refusal band that `015de49` owed and did not deliver. F3, F4 and F5
are deliberately untouched and the `73ec822..4230858` range remains **NO-GO /
PUSH-ELIGIBLE NO / RUNTIME HOLD**. One finding per cycle keeps each repair
independently reviewable; it is not a claim that the others are discharged.

The gap was self-evidencing: the docstring at `:200` forward-referenced
`test_an_invocation_that_names_no_control_root_holds_without_calling_the_executor`
as the place required-ness is pinned, and no such test existed.

What landed, in `tests/test_scripts_inert.py` only (+255 lines, 7 new node ids):

- unstated roots hold without the executor being called;
- each malformed `--control-root` token holds the same way, parametrized over a
  token with no separator, an empty name, an empty path and a repeated name;
- a typed `PrecheckAbort` naming `repository_roots` is converted to a returned
  `HOLD_EXIT` rather than propagating, on a well-shaped mapping forwarded
  verbatim;
- the script does not restate the control key space, pinned over its AST.

The empty-executor-spy half is the load-bearing half of the first two: it pins
that neither artifact file is read before the refusal, which is the exact
ordering F2 named as reachable. All four refuse with **one spelling only**, a
returned `HOLD_EXIT` — verified by reading the diff — so **F14's three-spelling
count is not increased**.

Effectiveness evidence — the controls are not vacuous. Exercised offline against
synthetic reference implementations in `/tmp` scratch only; nothing was added to
the repository for it. They **admit** a correct reference `main` and an honest
`--help` example, and **refuse** F2's exact fold-to-`{}`-and-execute shape, each
malformed-token shape, a propagating `PrecheckAbort`, both key-space
duplications, and a `main` that returns `HOLD_EXIT` only after entering the
executor.

Static evidence at `4230858`, independently re-measured by a separate verifier
rather than taken from the commit message:

- Broad census: **1395 passed / 57 failed**, moved from 50 by exactly these 7
  new node ids. The delta was confirmed *differentially* — the `f6622d4` tree
  was archived to `/tmp`, censused there (1395 passed / 50 failed), and the
  sorted `FAILED` lists diffed: exactly the 7 new lines added, no other line
  changed.
- All 57 failures are the intended absent-script class, every one raised by
  `tests/conftest.py:93` `require_c8_path`. Breakdown:
  **48** `run_topology_rehearsal.py`, **8** `prepare_topology_grant.py`,
  **1** the `scripts` directory itself. **Zero** assertion failures, import
  errors or collection errors.
- Focused suites (`test_adapter`, `test_runner`, `test_admission`,
  `test_preparation`, `test_plan`): **901 passed / 0 failed**.
- `python -m compileall tests/ src/` — OK.
- `git diff --check` — clean.
- `ruff check tests/test_scripts_inert.py` — All checks passed, but on
  `/opt/homebrew/bin/ruff`; `.venv/bin/ruff` still does not exist, so **F15
  stands unchanged**. This is not a claim that the pinned lint gate ran.
- Sizes: `adapter.py` **799**, `observe.py` **542**, `test_scripts_inert.py`
  1384. **F16 stands unchanged** — the size bound is still met with one line of
  headroom.

Neither entrypoint script was executed and neither exists. No `src/`, docs,
dependency or lockfile change. RUNTIME remains **HOLD**.

### `33588bf..HEAD` — F4/F12/F17/F7 repair, spec truth

One commit, `docs/ENTRYPOINT-SLICE-SPEC.md` only (+110/−31), repairing four
recorded findings that were all confined to that one file: **F4 (P1)**,
**F12 (P2)**, **F7 (P2)** and **F17 (P3)**. F3 and F5 are deliberately untouched
and `73ec822..HEAD` remains **NO-GO / PUSH-ELIGIBLE NO / RUNTIME HOLD**.

This is a documentation-truth repair, so the tests are the source of truth: every
normative claim in the rewritten regions now carries the
`tests/test_scripts_inert.py` line that pins it, and the section states that
where a citation and the file disagree, the file wins.

| Finding | Old range | New range | Resolution |
|---|---|---|---|
| F4 (P1) | `:53-78` | `:53-114` | `## run_topology_rehearsal.py` rewritten to the argv-boundary shape; all five disagreements corrected |
| F12 (P2) | `:80-89` | `:116-138` | Heading now "Four obstacles"; obstacle 1 restated as `.plan`-only, `.runner` half recorded as withdrawn |
| F7 (P2) | `:473-475` | `:526-554` | Owed-path item 4 expanded to three edits; false "nothing else weakens" sentence withdrawn |
| F17 (P3) | `:328-329` | `:377-384` | argparse-`required` replaced by required-ness pinned as a returned `HOLD_EXIT` |

F4's five corrections: `--control-root NAME=PATH` added as repeatable and
*accumulating* (`:207-215`); `main` calls
`execute(args.grant, args.signature, repository_roots=<mapping>)` (`:237-245`);
`execute_authorized_attempt` gains keyword-only `repository_roots` with no
default (`:569-617`); the `wiring_builder` call carries `repository_roots`
(`:538-566`); `build_runtime_wiring` gains mandatory keyword-only
`repository_roots` (`:1064-1108`). Also corrected in the same region:
`load_runtime_dependencies()` was described as returning "a triple"; it answers a
zero-argument object with `authorization_loader`/`wiring_builder`/`runner`
attributes (`:620-630`).

**F7 is recorded as a deletion, not a move — this is the load-bearing part.**
With `FRONT_DOOR_ABSENT_MODULES` already `()` (`test_surface_contract.py:77`),
once the scripts land the only docstring satisfying `:176`, `:226`, `:227-230`
and `:231` at once carries a sentence about nothing. The spec now says
`FRONT_DOOR_ABSENCE_CLAIM` (`:73`), the docstring requirement (`:176`) and the
`absence_sentence` half of `:226-231` are owed a **retirement decision**, names
what keeps their falsifiability (`:184`, `:185`, `:220-224` extended to both
script names), and explicitly withdraws the former "Nothing else in that file
weakens" sentence as false. The narrower surviving claim: no control over
anything that still exists is weakened — the size bound (`:237-249`),
single-spawn-site control (`:355-431`), scripts-root inventory (`:438-450`) and
unevidenced-status regex (`:233`) stay exactly as reviewed. Retiring an absence
control at the moment its subject stops being absent must be reviewed as a
deletion. **No control was relaxed by this commit**; the spec records what the
GREEN owes, and `tests/test_surface_contract.py` is untouched.

Citation spot-check by the coordinator, independent of the writer: five cited
lines were read directly and all resolve exactly as claimed —
`test_scripts_inert.py:207-215` (`list(args.control_root) == [...]`), `:237-245`
(`execute(grant, signature, *, repository_roots)` recorder), `:1064`
(`test_the_control_roots_are_a_mandatory_keyword_argument_with_no_default`),
`test_adapter.py:146,150` (`instance.plan is plan`, `not hasattr(instance,
"runner")`), and `observe.py:510` (`class CommandAdapterAccessors`).

#### New findings opened by this repair

The writer surfaced four further spec defects outside its four-finding scope and
reported rather than silently fixed them. All are documentation accuracy with no
control impact; none blocks.

**F18 — P3 — `ENTRYPOINT-SLICE-SPEC.md:162`** names
`test_runtime_wiring_injects_the_one_executor_into_every_command_adapter`, which
does not exist at HEAD. The `wiring.plan.commands` assertion now lives in
`test_runtime_wiring_builds_the_reviewed_plan_and_the_five_command_adapters`
(`tests/test_scripts_inert.py:817-822`).

**F19 — P3 — `ENTRYPOINT-SLICE-SPEC.md:413-414`** says "amend six" and then lists
five sites (`:154`, `:171`, `:201`, `:265`, and a comment at `:285`). Arithmetic
error in the `42bc6f7` adjudication. The "add six" half is already tracked by F2.

**F20 — P3 — `ENTRYPOINT-SLICE-SPEC.md:213-214`** says the
`CommandAdapterAccessors` mixin is "uncommitted" and "supplies both" `.plan` and
`.runner`. Both halves are now false. It sits under an explicit
`ADJUDICATED — REFUTED` banner retained as the record of a tested claim, so it is
not a live normative claim, but a reader could misread it.

**F21 — P3 — `ENTRYPOINT-SLICE-SPEC.md:377-435`** — every line number in the
`42bc6f7` adjudication section (`:272`, `:175`, `:247`, `:244`, `:201`,
`:265-269`, `:682`, `:841`) predates `015de49` and no longer resolves in the
current test file. Historical by construction, but nothing in the section says so.

#### Static evidence at this commit

- Broad census unchanged at **1395 passed / 57 failed**, all the intended
  absent-script class. Re-run because the component carries an unevidenced-status
  regex control (`test_surface_contract.py:233`) that reads documentation.
- `git diff --check` clean. Docs-only change; no `src/`, no tests, no
  dependency, no lockfile change. Neither entrypoint script exists or was run.

### `817227b..a1a97f6` — F3 repair, measured evidence

One commit, `tests/test_scripts_inert.py` only (+236/−27), repairing exactly one
recorded finding: **F3 (P1)**, the anti-self-witnessing guard that forbade the
only read making the wiring buildable while missing the evasion that mattered.
F5 and the open P2/P3 set are deliberately untouched and `73ec822..a1a97f6`
remains **NO-GO / PUSH-ELIGIBLE NO / RUNTIME HOLD**.

**The independent review of this repair is NOT yet recorded.** The reviewer lane
did not return inside the cycle. Nothing below is a verdict; it is measurement
only, and the repair is a recoverable local checkpoint, not push eligibility.

What landed:

- `test_no_control_root_anywhere_in_the_wiring_module_derives_from_the_grant`
  (`:1338`) walks the whole module rather than one function, resolves
  `grant_derived_names` to a **fixed point** so helper-of-helper chains are
  followed, collects `root_sinks` (the `repository_roots` keyword plus any
  binding named `root`/`roots` or suffixed `_root`/`_roots`), and asserts no sink
  derives from `GRANT_ATTRIBUTES | HOST_ROOT_SOURCES`.
- The blanket `grant` ban at the old `:1006` is withdrawn; the function-scoped
  forbidden set narrows to the host-observation set `{getcwd, cwd, environ,
  argv}`. This is exactly the fix F3 prescribed.
- The blanket `getattr` ban is withdrawn and replaced by `attribute_reads`
  (normalises `getattr(x, "lit")` into a read of `lit`) plus
  `computed_attribute_reads` (refuses any non-literal `getattr` outright).
- Anti-vacuity: `len(sinks) >= 2` guards against a module that passes by saying
  nothing. Against the spec's own conforming shape (`:377-388`) a real
  implementation has at least three sinks — the `_control_roots` helper plus the
  `repository_roots` keyword passes through `execute_authorized_attempt` and
  `build_runtime_wiring` — so the bound is not a false blocker.

**`argv` is deliberately not a forbidden origin of the module-wide test.** The
operator's `--control-root` tokens *are* argv, so argv is the one honest source
of a root; banning it module-wide would forbid the very contract
`test_the_control_roots_are_a_mandatory_keyword_argument_with_no_default` pins.
The wiring's own freedom from argv stays in the function-scoped guard, unchanged.

Effectiveness evidence — independently produced by a separate verifier against
verbatim-copied helper bodies and 13 synthetic module sources under `/tmp`
scratch only; nothing was added to the repository for it. All 16 sub-cases
matched their predicted verdicts:

| Case | New check | Old check |
|---|---|---|
| F3's exact evasion: `_roots(authorization)` reads `.grant`, sink calls it | **FLAGGED** | not flagged |
| Two-hop `_a`→`_b`→sink (fixed point beyond depth 1) | **FLAGGED** | not flagged |
| Module helper reading `os.environ` for a root | **FLAGGED** | not flagged |
| Honest wiring: roots from the injected argument only, grant read solely for the attempt identity | not flagged | **FLAGGED** |
| Module with fewer than two root sinks | anti-vacuity trip | not checked |
| `getattr(os, "environ")` | refused | refused |
| `getattr(authorization, "repository_roots")` | refused | refused |
| `getattr(x, <computed>)` | refused | refused |

The verifier hunted specifically for coverage loss. `getattr(authorization,
"grant")` reaching a root is **still caught**, by the module-wide test, even
though the function-scoped set no longer names `grant`. The only cases the old
bans caught and the new pair does not are (a) a grant read reaching the *attempt
identity* rather than a root, and (b) a `getattr` touching no forbidden name at
all — both are precisely the over-breadth F3 required to be withdrawn. **No case
was found where the old check caught a genuine root-derivation defect the new
one misses.**

Static evidence at `a1a97f6`, measured by the coordinator:

- Broad census: **1395 passed / 58 failed**, moved from 57 by exactly one node
  id. Confirmed **differentially** — the `817227b` tree was archived to
  `/tmp/f3-base`, censused there (1395 passed / 57 failed), and the sorted
  `FAILED` lists diffed: exactly one line added
  (`test_no_control_root_anywhere_in_the_wiring_module_derives_from_the_grant`),
  no other line changed.
- All 58 failures are the intended absent-script class, every one raised by
  `require_c8_path`. Breakdown: **49** `run_topology_rehearsal.py`, **8**
  `prepare_topology_grant.py`, **1** the `scripts` directory itself. **Zero**
  assertion failures, import errors or collection errors. Both new tests fail
  closed on the absent script, not on their own AST logic.
- Focused suites (`test_adapter`, `test_runner`, `test_admission`,
  `test_preparation`, `test_plan`): **901 passed / 0 failed**, unchanged.
- `python -m compileall tests/test_scripts_inert.py` — OK.
- `git diff --check` — clean.
- No top-level helper name in the new block shadows an existing definition;
  the file has zero duplicate top-level `def` names.
- `ruff check tests/test_scripts_inert.py` — All checks passed, but on
  `/opt/homebrew/bin/ruff`; `.venv/bin/ruff` still does not exist, so **F15
  stands unchanged**. This is not a claim that the pinned lint gate ran.
- Sizes: `adapter.py` **799**, `observe.py` **542**, `test_scripts_inert.py`
  1593. All `src/` files remain under the strict `< 800` bound; **F16 stands
  unchanged**.

Tests only. No `src/`, docs, dependency or lockfile change in the test commit.
Neither entrypoint script was executed and neither exists. RUNTIME remains
**HOLD**.

### `817227b..a1a97f6` — F3 repair, independent review

Independent Opus review of the F3 repair range, read-only, run at `c2d688c` with
the tree unmodified. The reviewer extracted the nine new helpers verbatim into
`/tmp/f3rev/guards.py` and ran 13 synthetic module sources against both the new
pair and the `817227b` old guard; nothing was added to the repository for it.

**VERDICT NO-GO. P0=0 P1=2 P2=3 P3=2. PUSH-ELIGIBLE NO. RUNTIME HOLD.**

What the review confirms positively, so the repair is not re-litigated: F3's
exact recorded evasion (`_roots(authorization)` reading `.grant`, called from the
sink) is now **FLAGGED**; the fixed point genuinely follows two-hop helper
chains, tuple unpacking, aliasing, comprehensions and class methods, verified
positively against synthetic sources; and it terminates, because `derived` grows
monotonically over the finite set of module-bound names with `grown <= derived`
as the exit. The new test also fails closed for the intended reason — its
message is `missing C8 implementation … run_topology_rehearsal.py does not
exist`, not an AST-logic failure. The spec's own conforming shape
(`ENTRYPOINT-SLICE-SPEC.md:377-388`) yields at least three sinks and is not
flagged, so the anti-vacuity floor is not a false blocker for it, subject to F27.

**F3 is NOT discharged.** Three fresh evasions of the same class pass, and one
genuine defect the withdrawn blanket `grant` ban caught is now admitted. That
last point directly refutes this ledger's own claim at the F3-repair evidence
section — "No case was found where the old check caught a genuine
root-derivation defect the new one misses" — and refutes the in-file claims that
the new pair is "strictly stronger" (`test_scripts_inert.py:1448`) and that
"between them lose nothing" (`:1454`). **Those three sentences are now known
false and are themselves owed a correction (F23).** They are left standing here
rather than silently edited, so the record shows what was claimed and what
disproved it.

**F22 — P1 — `tests/test_scripts_inert.py:1402` — the module-wide test never
applies `computed_attribute_reads`, so a computed `getattr` in a module helper
reaches a root undetected.** `computed_attribute_reads` is asserted only at
`:1480`, inside the *function-scoped* guard; the module-wide walk at
`:1402-1408` calls only `root_sinks`, `grant_derived_names`, `forbidden_origins`
and `name_reads`. Because `literal_getattr_name` (`:1235`) returns `None` for a
non-literal, `attribute_reads` (`:1244`) records **no read at all** and the
helper never enters `derived`. Verified-passing source: `FIELD = "grant"` /
`def _roots(authorization): return getattr(authorization, FIELD)["repositories"]`
/ `plan.build_plan(repository_roots=_roots(authorization))` — F3's defect
respelled in one extra line. Fix: add
`assert computed_attribute_reads(module) == []` to the module-wide test body
after `:1401`.

**F23 — P1 — `tests/test_scripts_inert.py:1336-1341` — `root_sinks` recognises
only a literal `repository_roots=` keyword, so a `**` splat launders a
grant-derived root; this is a net coverage loss against the withdrawn ban.** The
`named` comprehension requires `keyword.arg == ROOT_KEYWORD`; a `**mapping`
argument carries `keyword.arg is None`, so the sink vanishes, and the dict that
built it is bound to a non-root-shaped name so `held` (`:1344-1346`) misses it
too. Verified inside `build_runtime_wiring` itself:
`arguments = {"repository_roots": authorization.grant["repositories"]}` /
`return plan.build_plan(**arguments)` — flagged by the old blanket `grant` ban,
passes both new tests. The run-time recording at `:1485` cannot catch it either,
because it filters on `"root" in name` while the read is `.grant`. Fix: in
`root_sinks`, also treat any `keyword.arg is None` value, and any `ast.Dict`
containing the constant key `"repository_roots"`, as a sink — and withdraw the
three false claims named above.

**F24 — P2 — `tests/test_scripts_inert.py:1275-1297` — `module_bindings`
propagates taint only through `Assign`-bound bare `Name`s, so in-place mutation
and method-call returns launder the grant.** There is no branch for `ast.Expr`
calls, `global`/`nonlocal`, or attribute-valued reads, and the offence check at
`:1405` intersects `derived` against `name_reads` only, so a derived *method*
name is never matched. Two verified-passing sources: (a) `_CACHE = {}` /
`def _fill(a): _CACHE.update(a.grant["repositories"])` /
`repository_roots=dict(_CACHE)` — `.update` is an `Expr`, never a binding, so
`_CACHE` stays clean; (b) a `class _Source` with
`def resolve(self): return self.envelope.grant[...]` /
`repository_roots=source.resolve()` — `resolve` enters `derived` but is read as
an `ast.Attribute`, not a `Name`. Fix: treat the receiver of any mutating method
call as bound from its arguments, and intersect `derived` against
`attribute_reads(sink)` as well as `name_reads(sink)`.

**F25 — P2 — `tests/test_scripts_inert.py:1213` and `:1469` —
`HOST_ROOT_SOURCES` omits `getenv`, and the `argv` exemption admits
`sys.argv[0]` as a host-derived root.** `{"environ", "getcwd", "cwd",
"__file__"}` does not contain `getenv`, and neither does the function-scoped set
at `:1469`. Pre-existing at `817227b`, but this commit re-states the set as the
definitive host-observation inventory. Verified passing on both guards:
`suite_root = os.getenv("CYBRIK_SUITE_ROOT")` fed to `repository_roots=` inside
`build_runtime_wiring`. Separately, the deliberate module-wide `argv` exemption
lets `def _here(): return pathlib.Path(sys.argv[0]).resolve().parent.parent`
feed a root — `argv[0]` is the interpreter's script path, not the operator's
`--control-root` tokens, so the exemption's stated justification does not cover
it. Fix: add `getenv`, `environb`, `expanduser`, `home` to `HOST_ROOT_SOURCES`
and to `:1469`, and flag a module-wide `argv` read whose subscript is the
constant `0`.

**F26 — P2 — `tests/test_scripts_inert.py:1400` — the anti-vacuity floor is
satisfiable with zero real root sinks and does not enforce what its own message
asserts.** `held` (`:1344-1346`) counts *any* binding named `root`/`roots` or
suffixed `_root`/`_roots`, including `ast.For` and `ast.comprehension` targets.
Verified: a module whose only root-shaped names are two `for root in …:` loop
variables, and which never passes `repository_roots=` anywhere, satisfies
`len(sinks) >= 2` and reaches `assert sorted(offences) == []` vacuously — while
the message claims "the injected roots must reach the plan through a named
argument". Fix: split the floor — require `len(named) >= 2` on the keyword sinks
specifically, and keep `held` as an additional, uncounted source of sinks.

**F27 — P3 — `tests/test_scripts_inert.py:1327-1347` — a `def` sink is checked
with `forbidden_origins` over its entire body, so a helper that only *validates*
against the grant is flagged as deriving a root from it.** `module_bindings`
binds a `FunctionDef` name to the whole node (`:1283`), and
`forbidden_origins(sink)` at `:1405` then sees every attribute anywhere in the
body. Verified flagged: `def _control_roots(pairs, authorization): roots =
dict(pairs); if set(roots) != set(authorization.grant["repositories"]): raise
ValueError(...); return roots` — no root value derives from the grant, only an
exact-key-set refusal is stated, yet the test reports two offences. This would
block a legitimate implementation that cross-checks the operator's keys against
the signed manifest. Fix: for `def` sinks, check only the expressions reachable
from `return`/`yield`, not the whole body.

**F28 — P3 — `tests/test_scripts_inert.py:1225-1233` — `getattr_calls` matches
only a bare `ast.Name` named `getattr`, so `builtins.getattr` bypasses both the
normalisation and the computed refusal.** The comprehension requires
`isinstance(child.func, ast.Name) and child.func.id == "getattr"`; for
`builtins.getattr(a, "environ")` the func is an `ast.Attribute`, so
`attribute_reads` returns `{"getattr"}` (measured) rather than
`{"getattr", "environ"}`, and `computed_attribute_reads` returns `[]` (measured)
even for a computed name. The same hole covers `operator.attrgetter("grant")`
and `vars(a)["grant"]`. Fix: also match `ast.Attribute` funcs whose `.attr` is
`getattr`, and add `attrgetter`/`vars`/`__dict__` to the refused set.

Nothing found at P0. No name shadowing: all nine new module-level helpers
(`name_reads`, `getattr_calls`, `literal_getattr_name`, `attribute_reads`,
`computed_attribute_reads`, `module_bindings`, `grant_derived_names`,
`forbidden_origins`, `root_sinks`) are each defined exactly once across
`tests/`, none is `test_`-prefixed, and none collides with `conftest.py`.

**Open blocking set after this review.** F5 (P1) and the newly-opened F22 (P1)
and F23 (P1) block GO. The open P2 set is F6, F8, F9, F10, F11, F13, F24, F25,
F26. The open P3 set is F14, F15, F16, F18, F19, F20, F21, F27, F28. F1, F2, F3
were repaired but **F3 is re-opened by F22/F23**; F4, F7, F12, F17 remain
repaired. `73ec822..HEAD` is **NO-GO / PUSH-ELIGIBLE NO / RUNTIME HOLD**.

### `a1a97f6..HEAD` — attempt identity vs. composition-time plan, measured RED

Not an independent review. This section records a **new defect found while the F3
repair was under review**, the RED that states it, and the exact measurement of
that RED. It is recorded before any repair so the finding cannot be lost the way
a prior cycle's findings were.

**F29 — P1 — `src/.../runner.py` `_attempt_names` vs. the composition root — the
created names and the enforced names agree on exactly one host in the world.**
The runner derives the attempt id from the *live* `prepared.image["observed_at"]`,
which preparation admits at or after the grant's pinned instant rather than only
at it. The plan those names are checked against is built by
`build_runtime_wiring(*, authorization, repository_roots)`, which is handed no
host observation at all, so it can only ever carry the grant's pinned instant.
The two therefore coincide only when the host reports the same second the grant
was signed on. On any real host — one second later is enough — the first create
is refused by the shipped `DockerCommandAdapter`'s own `protocols.require_exact`
check, the attempt returns `creation: raised ValueError: …`, and the rehearsal
fails closed on every execution it will ever have.

Failing closed is not the same as working. The single authorized attempt would be
spent proving that the names disagree.

Why nothing caught it: every pre-existing runner test is green only because
`fakes.IMAGE_OBSERVED_AT` *is* that exact instant, so the whole suite states the
lifecycle at the single reading where the defect is invisible. The existing
`fakes.FakeDocker` records whatever name it is handed and never refuses, so no
test stated whether the shipped port would accept what the runner asks for.

**The RED.** `tests/test_runner.py` adds `PlanBoundDocker` and
`PlanBoundCredential` — ports that reproduce the shipped refusal through the real
`protocols.require_exact` and a real `build_plan` result rather than a
hand-written compare — and states the property across the whole admitted band:

| Test | Observation | Expected | Measured |
|---|---|---|---|
| `…_still_creates_names_the_plan_accepts[one-second-later]` | `2026-08-05T00:00:01Z` | FAIL (intended) | FAIL — `creation: raised ValueError: name: 'cybrik-topology-net-20260805T000001Z-c8' is not the reviewed 'cybrik-topology-ne…'`; `STOP_CONTROL != TOPOLOGY_PASS` |
| `…_still_creates_names_the_plan_accepts[fifty-nine-seconds-later]` | `2026-08-05T00:00:59Z` | FAIL (intended) | FAIL — identical shape at `20260805T000059Z` |
| `…_the_plan_bound_ports_pass_at_the_one_instant_the_grant_pinned` | `fakes.IMAGE_OBSERVED_AT` | PASS (anti-vacuity) | PASS |

One second is the smallest gap a real host can produce; fifty-nine seconds is the
largest this authorization admits (the runtime observation must not pass the
loader's `now`), so the pair states the property across the admitted band rather
than at one instant. The control is what makes the two failures a statement about
the observation rather than about a fixture that refuses everything.

**Measured census at this commit** (`.venv/bin/python -m pytest -q`, read-only
verification, no runtime and no Docker): **60 failed, 1396 passed**. Of the 60,
**58** carry the known absent-entrypoint marker `missing C8 implementation …
scripts/{prepare_topology_grant.py,run_topology_rehearsal.py} does not exist`
(51 in `test_scripts_inert.py`, 7 in `test_surface_contract.py`); the remaining
**2** are the new intended REDs above. `tests/test_runner.py` collects 78 tests
with no import or name error, and is 76 passed / 2 failed on its own.

**F29 is open and unrepaired.** The property owed is agreement, not a particular
repair. A repair that keeps one composition-time plan must make the attempt
identity nameable before the host is read; a repair that completes the plan after
the observation must expose the seam that completes it, and the fixture must then
build its plan through that seam. Either way the created names and the enforced
names must be the same names for every observation the authorization admits.
Do not discharge F29 by pinning the fixture back to the grant instant — that is
the blindness this RED exists to remove.

### `b580b2c..eb472c1` — F29 RED, independent review

Independent Opus review of the F29 RED commit only, read-only against the shipped
source rather than the fixtures. Scope was deliberately one commit;
`tests/test_scripts_inert.py` was excluded because another lane was editing it.

**VERDICT GO on the RED. P0=0 P1=1 P2=1 P3=2. PUSH-ELIGIBLE NO. RUNTIME HOLD.**

Push-eligible is NO for the ordinary reason that the worktree is deliberately RED:
the two new tests fail on purpose. The GO is a statement that the RED is honest,
not that the range may be pushed.

**F29 is CONFIRMED REAL**, on shipped source, at four independent points:

- `src/…/runner.py:286-300` — `_attempt_names` reads
  `observed_at = prepared.image[OBSERVED_AT_KEY]`, the **live** host observation,
  and formats the attempt id from it, then derives every name from that id.
- `src/…/preparation.py:607-618` — the only observation-time refusal is
  `elif signed_at is None or observed_at < signed_at:`. An `observed_at` strictly
  **later** than the grant pin is **admitted**. The band
  `LATER_HOST_OBSERVATIONS` states is therefore correct, and the obvious defence
  — "preparation requires equality with the pin" — is refuted.
- `src/…/plan.py:437-460` — `build_plan(*, attempt_id, image_reference,
  repository_roots)` takes the attempt id as an input and has no observation
  input at all.
- `src/…/adapter.py:364-398, 445-454, 627` and `protocols.py:93-96` — the shipped
  `DockerCommandAdapter` and `FileCredentialAdapter` really do call
  `require_exact` before create, start and remove, raising
  `ValueError(f"{label}: {observed!r} is not the reviewed {expected!r}")`.
  `PlanBoundDocker`/`PlanBoundCredential` therefore **reproduce shipped behaviour
  and are not a fixture invention** that manufactures a failure the real system
  would not have.

**Why F29 is a design defect and not a wiring oversight.** The host image
observation is itself obtained through `DockerCommandAdapter`, which is
constructed already bound to a plan. A plan therefore cannot be built *after* the
observation without introducing a new seam. The circularity is the finding.

The review also confirms the fixture does not beg the question: `fakes.py:85`
`IMAGE_OBSERVED_AT = "2026-08-05T00:00:00Z"` and `fakes.py:130`
`SYNTHETIC_ATTEMPT_ID = "20260805T000000Z-c8"`; the test asserts the plan's
attempt id as a *precondition* and then compares against names the runner derived
independently, so the two sides come from different code paths. The commit is
additive only — 191 insertions, 0 deletions, one file — with nothing weakened, no
assertion deleted and no guard relaxed. No name shadowing: all five new module
names are defined exactly once across `tests/` with no `conftest.py` collision.

**F29-A — P2 — `tests/test_runner.py:888-897` — the docstring states a shipped
fact that is not shipped.** It asserts in the present tense that
`build_runtime_wiring(*, authorization, repository_roots)` "is handed no host
observation at all", but `integration/topology-rehearsal/scripts/` does not exist
in this worktree; that signature is pinned only by `tests/test_scripts_inert.py:115`
and by this ledger. A reader of the test alone would believe the composition root
is shipped. The commit message discloses this; the docstring does not. Fix: one
clause — say the wiring is specified-and-pinned, not shipped. The defect claim
itself survives, because any implementation of that pinned signature meets the
circularity above.

**F29-B — P3 — `tests/test_runner.py:1041-1063` — the anti-vacuity control cannot
alone distinguish "ports refuse correctly" from "ports are inert".** Inert ports
would also make it pass. It is sound only jointly with the RED failing, since
inert ports would make the RED pass too. Fix: assert `pytest.raises(ValueError)`
when `PlanBoundDocker.create_network` is handed a wrong name.

**F29-C — P3 — `tests/test_runner.py:918-946` — the plan-bound ports
under-reproduce the shipped ones.** `create_container` omits the shipped
`require_exact("image", …)` and `remove` drops the shipped unknown-kind
`ValueError` (`adapter.py:449-451`). This under-reproduces and never
over-reproduces, so it cannot manufacture a failure the real system would not
have; recorded rather than repaired.

**Explicitly not checked by this reviewer**, recorded so it is not mistaken for
cleared: the "fifty-nine seconds is the largest this authorization admits" upper
bound was not verified against the loader's `now` (`grant.py:699` has
`opening <= observed_at < expiry`, but the fixture envelope's `now` was not read);
the rest of `test_runner.py` and the wider suite were not run (only the three new
tests, 75 deselected); and the inert-port control was reasoned about analytically
rather than by building the `/tmp` scratch variant, for budget.

**Open blocking set is unchanged by this review**: F5, F22, F23 (P1) still block
GO on `73ec822..HEAD`, and F29 (P1) is now added as an open unrepaired defect.
`73ec822..HEAD` remains **NO-GO / PUSH-ELIGIBLE NO / RUNTIME HOLD**.

### `a976c6d..e3d6116` — F22/F23 repair, measured evidence

One commit, one file, `tests/test_scripts_inert.py`, 400 insertions / 20
deletions. It repairs the two P1 findings the F3-repair review raised against the
module-wide root-derivation guard, and it adds the guard's missing effectiveness
proof. It creates no entrypoint and touches no `src/` module.

**F22 (P1) — claimed repaired.** The computed-attribute refusal now runs over the
whole module. `module_wide_offences(module)` folds
`computed_attribute_reads(module)` into the offence list before walking the sinks,
so `FIELD = "grant"` with `getattr(authorization, FIELD)` in a module helper — the
exact source the review recorded as verified-passing — is refused at the `getattr`
itself rather than needing an attribute read that `literal_getattr_name` never
records. The repair is stated as a function, not inline in the test, so the
effectiveness proof below runs the identical path the assertion runs; a proof that
restated the walk would drift from it silently.

**F23 (P1) — claimed repaired.** `root_sinks` now returns four shapes, not two:
the literal `repository_roots=` keyword, any `keyword.arg is None` (`**`) value,
any `ast.Dict` carrying the constant key `repository_roots`, and the root-shaped
bindings it already held. The recorded evasion
`arguments = {"repository_roots": authorization.grant[...]}` /
`plan.build_plan(**arguments)` is now caught twice over. The breadth is not free
and is disclosed in the helper's docstring: a splat carrying a grant-derived
mapping is refused even when the root inside it is honest, because from outside the
call the walk cannot tell the two apart. The honest spelling is the named keyword,
which the spec's conforming shape already uses.

**The guard is now exercised, not merely asserted.** This was the gap that let
independent review, rather than this file, find F22 and F23.
`EVADING_WIRING_SHAPES` carries nine sources — the two evasions above plus the
seven reaches the guard was claimed to have (module-level helper, two-hop chain,
grant bytes handle, host-observing helper, tuple unpacking, alias, comprehension
target) — and each is run through `module_wide_offences` and must be flagged.
`CONFORMING_WIRING_SHAPE` carries the shape
`docs/ENTRYPOINT-SLICE-SPEC.md:377-388` adjudicated and must **not** be flagged,
so a walk that refused the reviewed design fails here as a false blocker instead
of reading like a genuine finding. Every shape asserts the anti-vacuity floor
before the offence, so a source flagged only for being too small cannot be
mistaken for one the derivation walk caught.

**Two false claims withdrawn in place.** The claim that the module-wide guard was
*strictly stronger* than the withdrawn blanket `grant` ban was false — F23 is a
case the ban caught and the replacement admitted — and it is withdrawn rather than
quietly corrected, with the reason stated: a walk over bound names cannot be a
superset of a ban on bytes by construction. The claim that the two narrower
`getattr` controls *between them lose nothing* was false as stated; it held only
inside the reviewed function, which is F22.

**Remaining losses are named, not claimed away.** `getattr_calls` matches only a
bare `getattr`, so `builtins.getattr(x, name)` yields no computed refusal;
`operator.attrgetter` and `vars(x)["grant"]` are not seen at all; taint that
leaves the set of bound names — mutated into an existing container in place, or
returned from a method and read as an attribute rather than a bare `Name` — still
passes. These are F24's class and stay open.

**F26 (P2) is NOT repaired by this commit, and this commit makes it easier to
satisfy.** The review's exact fix was to require `len(named) >= 2` on the *named
keyword* sinks specifically and keep the other shapes uncounted. This commit
instead widened `root_sinks` while leaving the floor counting every shape, so the
floor is now satisfiable by more sources than before, not fewer. That is a real
regression against F26's severity and is recorded here rather than left for the
next reviewer to rediscover. F24, F25, F27 and F28 are likewise untouched.

**Measured census at `e3d6116`** (`.venv/bin/python -m pytest -q`, read-only, no
runtime and no Docker): **60 failed, 1398 passed**. The failure count is unchanged
in kind and in number from `a976c6d`: **58** carry the absent-entrypoint marker
(51 in `test_scripts_inert.py`, 7 in `test_surface_contract.py`) and **2** are the
intended F29 REDs in `test_runner.py`. Passes rose 1396 → 1398, exactly the two
new tests. `python -m compileall` on the changed file is clean. No lint or type
checker is installed in this venv and none was installed, so lint and typecheck
are **not measured** at this commit.

No control was weakened, no assertion deleted and no guard narrowed: the 20
deletions are the two withdrawn-claim paragraphs, the inlined offence loop now
folded into `module_wide_offences`, and the two-shape `root_sinks` return.

**This range has NOT yet received an independent verdict**; the entry above is the
implementer's own measured evidence and its claims are unverified until a reviewer
records a verdict below.

### `73ec822..e3d6116` — independent audit of every open finding against live source

An independent read-only auditor re-derived the status of every finding this
ledger records, checking **live source rather than ledger prose**, at
`e3d6116`. This exists because the ledger had accumulated repair *claims* across
several commits and no one had confirmed which of them survive in the code.

The auditor re-measured the census itself: **60 failed / 1398 passed**, 58
absent-entrypoint, 2 intended F29 REDs at `tests/test_runner.py:1038`. That is an
independent confirmation of the number recorded in the section above.

It also raised a ledger-currency defect: at the moment it ran, `e3d6116` had no
ledger entry at all, which the ledger's own rule at `:12-17` forbids. That is
discharged by the preceding section, committed as `63496ff` after the audit
started. Recorded rather than silently fixed.

**Verified STILL OPEN in live code, with cites:**

- **F5 / F29 — P1, one defect under two IDs.** `src/…/runner.py:293` reads
  `observed_at = prepared.image[OBSERVED_AT_KEY]` — the live host observation —
  and derives every attempt name from it at `:300-307`; `src/…/preparation.py:613`
  admits a strictly-later observation (`elif signed_at is None or observed_at <
  signed_at:`); `src/…/plan.py:437-442` takes `attempt_id` as an input and has no
  observation input at all. Two live failing REDs already state the acceptance
  condition at `tests/test_runner.py:988-1051`.
- **P2, all confirmed present:** F26 (`:1466-1467`, and see below), F24
  (`:1283-1296`, no `Expr`/`global`/`nonlocal` branch; `:1397` intersects
  `name_reads` only), F25 (`:1213` and `:1849`; neither shape appears in
  `EVADING_WIRING_SHAPES`), F8 (`:908` filters on `_` prefix; walk is two levels
  at `:950-960`), F10 (`:684` asserts `__all__` against a list, never the module
  namespace), F9 (`:995` still publishes the raw executor; the containment
  assertion at `:562-566` predates the finding and discharges nothing), F6
  (`:588-596` precede a `pytest.raises(TypeError)` at `:611` and a vacuous
  `assert loaded == []` at `:617`), F13 (`args.execute` asserted only positively
  at `:210`), F11 (`src/…/observe.py:510-542`, still sited by the 800-line bound),
  F29-A (`tests/test_runner.py:892-893`).
- **P3, spot-checked and all still open:** F14, F15 (confirmed: `.venv/bin/` has
  no `ruff`), F16 (`adapter.py` is 799 lines), F18, F19, F20, F21, F27, F28,
  F29-B, F29-C.

**F26 is confirmed WIDENED by `e3d6116`, independently.** The floor at
`:1466-1467` is still `len(root_sinks(module)) >= 2` while `root_sinks` now returns
`named + splatted + keyed + held` at `:1372`, so strictly more shapes satisfy it
than when F26 was raised. This is the same regression the implementer disclosed in
the section above, now confirmed by someone who did not write it.

**Confirmed REPAIRED-BUT-UNVERIFIED** (mechanism present in live code, no
independent verdict): F22 (`:1391-1395`, asserted `:1469`, exercised `:1516-1538`
via `:1742`), F23 (`:1355-1365`, pinned `:1541-1558`, false claims withdrawn in
place at `:1806-1817` and `:1826-1837`), F1 (`:1893-1955`), F2 (four bands at
`:270`, `:317`, `:372`, `:438`), F4/F12/F17 (spec `:53-58`, `:116-125`,
`:377-386`), F7 (spec `:492+`).

**Authoritative open set at `e3d6116`: P0=0, P1=4, P2=10, P3=11.** The four P1s
are F5, F29, F22, F23; F5 and F29 are one underlying defect, and F22/F23 are
repaired-but-unreviewed, so the distinct unrepaired P1 defect count is **one**.

`73ec822..e3d6116` is **NO-GO / PUSH-ELIGIBLE NO / RUNTIME HOLD** on the
P0=P1=P2=0 criterion.

**Highest-value next repair, per the auditor: F5/F29.** It is the only open
finding in shipped `src/`; every other open item is a test-guard or documentation
defect. It is confirmed on shipped source at four independent points, it already
has a live executable RED so a repair is verifiable the moment it lands, and it is
the one defect that would spend the single authorized runtime attempt proving only
that the names disagree. No amount of test-guard repair makes a runtime GREEN
reachable while it stands.

### `e3d6116..HEAD` — F5/F29 repair, measured evidence

One commit, **shipped `src/` only, no test file touched**, repairing exactly the
one distinct unrepaired P1 defect the prior audit named as the highest-value next
repair: **F5/F29**, the attempt identity that agreed with the composition-time
plan on exactly one host in the world.

**The repair.** `PreparationResult` gains `granted_observed_at`
(`preparation.py:220`), populated in `snapshot()` from
`document["observed_image_identity"][OBSERVED_AT_KEY]` (`preparation.py:759`) —
the grant's *pinned* instant. `runner._attempt_names` now reads
`prepared.granted_observed_at` (`runner.py:307`) instead of the *live*
`prepared.image[OBSERVED_AT_KEY]`, and `OBSERVED_AT_KEY` is dropped from
`runner.py`'s `preparation` import because the runner no longer reads the live
instant at all. The live reading is untouched everywhere else: `_grant_facts`
still submits the live host identity to admission (`runner.py:280`), and
preparation's at-or-after check (`preparation.py:606-615`) still refuses any
observation before the pin, so a host that has not yet reached the pinned instant
still cannot name an attempt.

**Why this is the shape F29 owed.** F29 stated that a repair keeping one
composition-time plan "must make the attempt identity nameable before the host is
read". The pinned instant is carried by the signed authorization document, which
is exactly what `build_runtime_wiring(*, authorization, repository_roots)` holds
before any host is read. The created names and the enforced names are therefore
the same names for **every** observation the authorization admits, not for one.

**Measured evidence** (`.venv/bin/python -m pytest -q`, read-only, no runtime and
no Docker):

| Measurement | At `e3d6116` | At this commit |
|---|---|---|
| `tests/test_runner.py` alone | 76 passed / 2 failed | **78 passed / 0 failed** |
| Broad census | 60 failed / 1396 passed | **58 failed / 1400 passed** |
| Failures carrying `missing C8 implementation …` | 58 | **58** (51 `test_scripts_inert.py` + 7 `test_surface_contract.py`) |
| Unintended failures | 2 (the F29 REDs) | **0** |

Every remaining failure carries the known absent-entrypoint marker; the count was
measured by `grep -c`, not asserted.

**Anti-vacuity.** The two REDs
(`…_still_creates_names_the_plan_accepts[one-second-later]` and
`[fifty-nine-seconds-later]`) turned GREEN with **no test file in the diff** —
`git diff --stat` is `preparation.py` and `runner.py` only. This is the discharge
F29 demanded and not the one it forbade: the fixture was *not* pinned back to the
grant instant. The anti-vacuity control
`…_the_plan_bound_ports_pass_at_the_one_instant_the_grant_pinned` still passes, so
the plan-bound ports still accept something and have not become refuse-everything.

**F30 — P2 — `src/…/preparation.py:220` — the authority-bearing pinned instant is
a defaulted field.** `granted_observed_at: str = ""` is the only field on
`PreparationResult` with a default, and `__post_init__` (`:222-266`) validates
every other field while never touching this one.

**Correction — the original evidence for this finding was false, and is corrected
in place per the maintenance rule below.** This entry first claimed that "`grep`
finds no `PreparationResult(` in `tests/`, so nothing currently receives the
default". The independent reviewer refuted it and the refutation is confirmed by
measurement: `tests/test_preparation.py` binds the class as `result_type` and
constructs it four times as `result_type(**result_fields())` (`:635`, `:641`,
`:682`, `:695`). Measured directly: `PreparationResult` has **11** dataclass
fields, `result_fields()` returns **10** keys, and the constructed object's
`granted_observed_at` is `''`. The original grep searched for the literal class
name and missed every bound-name call site — the exact evasion class this
project's own AST guards exist to catch, committed here in a ledger claim.

The exposure is therefore live, not forward-looking: four existing tests already
exercise a result whose pinned instant is `""`. Behaviour stays fail-closed
(`instant("")` is `None` → `PrecheckAbort` at `runner.py:309-313`), but no test
reaches that branch — grepping `tests/` for the refusal message returns nothing —
so the default's only consumer is unexercised. A directly constructed result may
also carry a non-`str` or a `str` subclass, which contradicts `frozen()`'s
explicit refusal of safe-scalar subclasses at `:125-133` on a class documented as
a complete immutable snapshot (`:205`). Smallest honest repair: make the field
mandatory, and add a `__post_init__` branch requiring
`type(...) is str and instant(...) is not None`.

**F32 — P2 — `tests/test_preparation.py:322`, `:637-641` — the positive control
named "the exact proved field set" no longer constructs the proved field set.**
`result_fields()`'s docstring says "Exactly the field values one satisfied
preparation would have proved" and returns ten keys against eleven fields, so
`test_the_exact_proved_field_set_constructs` now asserts that a *different* shape
than `snapshot()` produces is coherent, and the negative parametrisations at
`:614-635` and `:645-682` all run against a result pinned to `""`. Preparation has
no field-inventory pin, unlike `tests/test_admission.py:803-806`, which asserts an
exact `dataclass_fields` tuple — that absence is why an eleventh field could be
added with no test noticing. Smallest honest repair: add the missing key to
`result_fields()` and mirror the admission `dataclass_fields` inventory pin for
`PreparationResult`.

**F33 — P1 — `src/…/runner.py:116-117`, `:307-314` — the attempt-id derivation
has no seam the composition root can call, so agreement is still carried by
convention across a module boundary.** The repair makes the identity nameable
before the host is read, which is what F29 owed at runtime, but the *formula*
lives in runner-private constants (`ATTEMPT_INSTANT_FORMAT`, `ATTEMPT_SLICE`)
that appear nowhere else in `src/` or `tests/`, inside a private
`_attempt_names(prepared: PreparationResult)` the wiring cannot call because it
holds no `PreparationResult`. `runner.__all__` is `["RehearsalResult",
"run_topology_rehearsal"]` (`runner.py:81`), so `build_runtime_wiring` must
re-implement the strftime format and the `-c8` suffix against the same grant
field. Two independent renderings of one identity is the same defect *class*
F29 was: nothing structurally prevents drift, and a divergence would again be
discovered only by spending the single authorized attempt. This is P1 by F29's
own acceptance wording — "the created names and the enforced names must be the
same names" — and not P0, because the runner side is correct and the RED it was
measured against is honestly green. Smallest honest repair: export one
`attempt_id_for(pinned_observed_at: str) -> str` (or site the formula in
`constants`/`plan`) and have both `_attempt_names` and the future wiring call it.
**This finding must be discharged by the entrypoint GREEN, not after it** — the
GREEN is what writes the second rendering.

**F34 — P3 — `tests/test_runner.py:866-885` — the runner's anti-self-witnessing
guard is a two-name denylist that cannot see the new grant-copied field.**
`..._neither_reads_the_grant_nor_pins_a_fixture_digest` bans `.grant` reads plus
the single name `selected_image_identity`, reasoning that it is copied straight
out of the grant so reading it would launder a granted fact back into the facts
that verify the grant. `granted_observed_at` is now a second field copied straight
out of the grant (`preparation.py:759`) and read at `runner.py:307`; the guard
neither bans nor entitles it. The substantive property still holds — the value
reaches evidence, never `_grant_facts` — so this is a coverage/honesty gap, not a
violation. Smallest honest repair: derive the denied set from the
`PreparationResult` fields `snapshot()` copies out of `document`, and record
`granted_observed_at` as the one named exception with its reason.

**F35 — P3 — `src/…/runner.py:314` — the attempt id is now constant per grant and
nothing states that property.** Every resource name is now a pure function of the
signed document, so two runs under one authorization request identical container,
network, volume and credential names. This is bounded today by the one-attempt
admission (`admission.py:288-292`) and fails closed on collision at `docker
create`, and it was already implied by the composition-time plan, so it is not a
regression — but it is a new property of the runner: an attempt that aborts
leaving a residual network, then retried under a re-signed grant carrying the same
pinned observation, collides by name rather than getting a fresh one. Smallest
honest repair: state the constancy and its residual interaction in the
`_attempt_names` docstring, or add a test naming the collision as intended
fail-closed behaviour.

**F31 — P2 — `src/…/preparation.py` — the repair bought its file-size headroom by
reflowing unrelated statements.** `preparation` is under the strict
`MODULE_LINE_LIMIT = 800` ("strictly under, not up to",
`tests/test_surface_contract.py:95`). The file measured 798 lines at `e3d6116`
and measures 798 now, but the repair *added* seven lines; it stayed under the
bound only because the same diff joined three unrelated multi-line statements onto
single lines (the `is not a deep proof` raise, the `are not control repositories`
append, and the `is not a Git object id` append). The reflows are semantically
inert — same expressions, same messages — and they are **load-bearing**: reverting
them puts the file at 804 and fails the surface contract. This is recorded rather
than reverted for that reason, but the module now has two lines of headroom and
the next change to it must extract, not reflow. Note also that repo-root
`CLAUDE.md` Founder-gates running formatters/auto-fixers; these three edits are
hand-scoped and inert, not a formatter run over the file, but the pattern is one
line away from that gate.

**Not yet discharged by this commit.** F22, F23, F26 and the whole open P2/P3 set
are untouched by design. This commit is one finding, test-first, as the cycle
contract requires.

**Independent review status: NOT OBTAINED.** An independent Opus review of exactly
this diff was commissioned in the same cycle and did **not** return before the
cycle closed. No verdict section follows this one, and none may be inferred. This
repair is therefore **claimed-repaired-but-unreviewed**, exactly like F22/F23 —
the measured evidence above is real, but measurement is not a verdict. F5/F29
stays on the open list until an independent reviewer reads this diff.

Until that verdict reads P0=P1=P2=0 across the whole local range,
`73ec822..HEAD` stays **PUSH-ELIGIBLE NO / RUNTIME HOLD**. The next cycle's first
action is to obtain that review of `e3d6116..8cc85de`.

### `73ec822..3ec75c1` — measured census, every failure classified

Measured at `3ec75c1` with `uv run --frozen pytest -q` from the package root:
**58 failed / 1400 passed.** Every one of the 58 was classified, not assumed. All
58 route through the fail-closed guard at `tests/conftest.py:93`
(`Failed: missing C8 implementation — this RED test states the final runner
behaviour and fails closed until it exists`), and the three distinct missing
targets are exactly:

- 49 × `scripts/run_topology_rehearsal.py does not exist`
- 8 × `scripts/prepare_topology_grant.py does not exist`
- 1 × `scripts does not exist`

**Unintended failures: zero.** By file the split is 51 in
`tests/test_scripts_inert.py` and 7 in `tests/test_surface_contract.py`.
(Corrected in place: this line first read "49 … and 9 …", which wrongly reused the
by-missing-target counts above as if they were per-file counts. The two
breakdowns partition the same 58 differently and only the per-target one was
measured; the per-file split was asserted without being run. It is now measured.)
This is
the whole intended absent-entrypoint RED chain and nothing else; no test fails for
a reason other than the two entrypoints being unwritten.

The owed-path list for the atomic GREEN was re-checked against the live tree
rather than against the spec's prose. Only `scripts/` and its two scripts are
absent. `src/…/__init__.py`, `tests/test_surface_contract.py`, `pyproject.toml`
and `tests/conftest.py` all already exist, so the GREEN amends them and creates
only the two scripts.

File-size headroom, measured, against the strict `< 800` bound `authored_sources()`
enforces: `adapter.py` 799, `preparation.py` 798, `grant.py` 794, `runner.py` 739,
`admission.py` 725. `adapter.py` and `preparation.py` have one and two lines of
headroom respectively — this is F16 and F31 measured, and it means the GREEN
cannot relocate anything into either module. `runner.py` has 61 lines, which is
where the F33 seam has to land.

**This census is not a verdict.** It states that the RED chain is honest and
uncontaminated; it does not discharge any open finding. The blocking set recorded
above — F5, F22, F23, F29 and the newly-opened F33 at P1 — is unchanged by it, so
`73ec822..3ec75c1` remains **PUSH-ELIGIBLE NO / RUNTIME HOLD**.

### `0953b9f..77eb7e1` — the F33 repair's measured evidence

`attempt_id_for(pinned_observed_at: str) -> str` is now exported from `runner`
and `_attempt_names` delegates to it. The formula is sited once.

RED first, before any `src/` edit: `pytest tests/test_runner.py -q` gave
**18 failed / 77 passed**, on `AttributeError: … has no attribute
'attempt_id_for'` and on `assert functions_reading("strftime") ==
{"attempt_id_for"}` returning `{'_attempt_names'}`. GREEN: **95 passed / 0
failed**.

Broad census **58 failed / 1417 passed**, against the 58/1400 baseline. The
counts alone would not have shown this: the sorted `FAILED` node-id lists were
captured before and after and diffed — **identical 58-line sets**. No intended
RED became a pass; the +17 is exactly the new items.

Behaviour is unchanged, verified rather than asserted. The rendered id was
captured from the pre-change source for four instants
(`20260805T000000Z-c8`, `20260805T000059Z-c8`, `19991231T235959Z-c8`,
`20261205T000001Z-c8`) and is byte-identical after. The refusal message is also
byte-identical — the line re-wrap concatenates to the same string, compared
literally. Independently re-measured by the coordinator: the seam is pure in its
argument, and `''` — the F30 default — `'not-an-instant'` and a
space-for-`T` near miss all raise `PrecheckAbort`.

Controls held. `runner.py` 739 → **756** against the `>= 800` bound at
`tests/test_surface_contract.py:95`, so 44 lines of headroom and no unrelated
reflow — the F31 pattern was not repeated. The anti-self-witnessing guard passes
unchanged and is not made vacuous: the new function reads no `.grant`, no
`selected_image_identity`, and adds no bare `"grant"` literal or 64-hex string.
`ruff` was already on `PATH`; `ruff check src tests` reports the same **two
pre-existing I001** findings before and after, and nothing was installed or
auto-fixed.

One control was deliberately widened, not silently admitted: `runner.__all__`
goes from two names to three. The pin at `tests/test_runner.py:313` is an exact
set rather than a superset, so it failed until re-pinned, and it now carries the
reason for the third name in its docstring.

**F33 is only half discharged, and the ledger should not claim more.** What is
proved is that the library side renders the identity in exactly one exported
place reachable with exactly what the composition root holds. What is *not*
proved is that `build_runtime_wiring` calls it rather than re-rendering the
format — the entrypoints do not exist yet, and that half is discharged only by
the GREEN. F33 therefore stays **OPEN, narrowed** rather than closed.

No independent verdict was obtained on this repair before the cycle ended, so
`73ec822..77eb7e1` remains **PUSH-ELIGIBLE NO / RUNTIME HOLD**.

### `73ec822..c444fcb` — static gates re-measured at the full local range

Measured by the coordinator at HEAD `c444fcb`, before any independent verdict
on this range was sought. Nothing was installed, auto-fixed or reformatted.

| Gate | Command | Result |
|---|---|---|
| Broad census | `uv run --offline python -m pytest -q` | **58 failed / 1417 passed** |
| Lint | `ruff check src tests` | 2 findings, both `I001`, both pre-existing |
| Compile | `python -m compileall -q src tests` | exit 0, no output |
| Whitespace | `git diff --check 73ec822..HEAD` | exit 0, no output |

The census matches the count recorded at `c444fcb` exactly, so the F33 repair
introduced no drift. The two `I001` findings are the same import-order pair
carried since before this range opened; `--fix` was **not** run, because
running a formatter or auto-fixer is Founder-gated by repo-root `CLAUDE.md`.

**A size-bound hazard the GREEN must plan around, recorded before it bites.**
`tests/conftest.py:106-111` defines `source_paths()` over `roots = (SRC,
SCRIPTS)`, and `tests/test_surface_contract.py:236-247` applies
`MODULE_LINE_LIMIT = 800` to every path that helper returns. The bound is
therefore **not** package-only: both entrypoint scripts, once they exist, are
judged by it, and it is `>= 800` — strictly under, not up to.

Measured line counts at this HEAD, worst first:

| File | Lines | Headroom to 800 |
|---|---|---|
| `src/…/adapter.py` | 799 | **1** |
| `src/…/preparation.py` | 798 | **2** |
| `src/…/grant.py` | 794 | 6 |
| `src/…/runner.py` | 756 | 44 |

`adapter.py` is one authored line from breaching a control this slice is
required not to weaken. The atomic entrypoint GREEN adds `build_runtime_wiring`
and five command-adapter constructions; `tests/test_scripts_inert.py:115`,
`:628`, `:1091` and `:1460` all resolve that symbol through
`require_c8_attr(script, …)`, so the wiring belongs in
`scripts/run_topology_rehearsal.py` and **not** in `adapter.py`. That is the
shape the tests already pin, and it is also the only shape that does not
breach the size bound on contact. Raising `MODULE_LINE_LIMIT` to make room
would be weakening a control to obtain GREEN and is refused.

RUNTIME remains **HOLD**. Neither entrypoint script was executed; neither
exists.

### Finding register at `c444fcb` — every ID F1..F35, status reconciled to live source

Until now the status of a finding could only be recovered by reading ~1500
lines of prose in which findings are opened by one review and repaired by a
later commit. That is how earlier cycles lost detail. This register is the
authoritative status index; the prose sections above remain the evidence.

Produced by an independent read-only pass that re-read the whole ledger and
then spot-checked **every closure claim against live source** at HEAD
`c444fcb`. Result of that cross-check: **no falsely-closed finding**. Each of
the six CLOSED items was confirmed present in shipped source, and each item
the ledger calls OPEN was confirmed still open.

| ID | Sev | Subject | Status |
|---|---|---|---|
| F1 | P1 | Single-shared-executor control deleted from default path | CLOSED |
| F2 | P1 | Argv-shape refusal band had zero tests | CLOSED |
| F3 | P1 | Anti-self-witnessing guard bans the only buildable read | **AMBIGUOUS** |
| F4 | P1 | Spec's normative contract section states a refuted shape | CLOSED |
| F5 | P1 | Attempt identity fixed from grant pin; runtime used live clock | OPEN — repaired, unreviewed |
| F6 | P2 | Behavioural half of the mandatory-roots test cannot fail | OPEN |
| F7 | P2 | Owed-path item 4 incomplete; false "nothing weakens" claim | CLOSED |
| F8 | P2 | Publication walk cannot see private names | OPEN |
| F9 | P2 | `wiring.command_runner` publishes the raw executor | OPEN |
| F10 | P2 | Surface bound pins `__all__`, not the public namespace | OPEN |
| F11 | P2 | `CommandAdapterAccessors` sited by line count, not cohesion | OPEN |
| F12 | P2 | Obstacle 1 describes the withdrawn `.runner` accessor as required | CLOSED |
| F13 | P2 | No negative case pins refusal when `--execute` is absent | OPEN |
| F14 | P3 | One operator mistake, three refusal spellings | OPEN |
| F15 | P3 | `.venv/bin/ruff` absent; the pinned lint gate never ran | OPEN |
| F16 | P3 | `adapter.py` at 799 against a strict `< 800` bound | OPEN |
| F17 | P3 | Spec claims an argparse-required `--control-root` | CLOSED |
| F18 | P3 | Spec names a test that does not exist | OPEN |
| F19 | P3 | Spec says "amend six", lists five | OPEN |
| F20 | P3 | Spec calls the mixin uncommitted while supplying `.runner` | OPEN |
| F21 | P3 | Adjudication section's line numbers no longer resolve | OPEN |
| F22 | P1 | Module-wide walk never applies `computed_attribute_reads` | OPEN — repaired, unreviewed |
| F23 | P1 | `**` splat launders a grant-derived root | OPEN — repaired, unreviewed |
| F24 | P2 | Taint escapes via mutation and method-call returns | OPEN |
| F25 | P2 | `HOST_ROOT_SOURCES` omits `getenv`; `argv[0]` exempted | OPEN |
| F26 | P2 | Anti-vacuity floor satisfiable with zero real sinks | **OPEN, WIDENED** |
| F27 | P3 | `def` sink checked over the whole body; validators falsely flagged | OPEN |
| F28 | P3 | `builtins.getattr` bypasses normalisation and computed refusal | OPEN |
| F29 | P1 | Created names and enforced names agree on only one host | OPEN — repaired, unreviewed |
| F30 | P2 | Authority-bearing pinned instant is a defaulted field | OPEN |
| F31 | P2 | Repair bought size headroom by reflowing unrelated statements | OPEN — recorded, not reverted |
| F32 | P2 | "Exact proved field set" returns ten of eleven fields | OPEN |
| F33 | P1 | Attempt-id formula had no seam the wiring can call | NARROWED / PARTIAL |
| F34 | P3 | Attempt denylist names only `selected_image_identity` | OPEN |
| F35 | P3 | (recorded at `:1386`) | OPEN |

Sub-IDs `F29-A` (P2), `F29-B` (P3) and `F29-C` (P3) are open and consume no
top-level number. **There are no gaps in F1..F35. The next unused finding
number is `F36`** — a future review must not restart numbering at F34.

**Counts at `c444fcb`:** 6 CLOSED, 1 AMBIGUOUS, 1 NARROWED, 27 OPEN.
Open P1s: **F5/F29** (one defect under two IDs), **F22**, **F23** — all three
repaired in shipped source but **none independently reviewed**. That is the
exact reason this range is not push-eligible.

**F3 is the one genuinely ambiguous entry and must not be silently dropped.**
`:850` states "F3 is NOT discharged"; `:963-964` states F3 is re-opened by
F22/F23. F22/F23 are since repaired, but no later section re-closes F3, and
the open set at `:1247-1249` lists only F5, F29, F22, F23. F3's fate is
therefore tracked entirely through F22/F23 and never restated. Owed: an
explicit re-closure or re-opening of F3 once F22/F23 receive a verdict.

**Correction to the section immediately above.** The `adapter.py` 799-line
hazard recorded there is not new — it is **F16**, opened at `:518` and
re-confirmed at `:1231` and `:1461`. The new facts in that section are only
that the bound provably spans `scripts/` as well as `src/`, and that the
entrypoint GREEN must therefore site `build_runtime_wiring` in the script.
The 799-line count itself was already on the books.

### `73ec822..211360b` — static gates re-measured at the current full local range

Measured by the coordinator at HEAD `211360b`, before any independent verdict on
this range was sought. Nothing was installed, auto-fixed or reformatted. The two
commits added since `c444fcb` (`8bee06a`, `211360b`) are documentation-only.

| Gate | Command | Result |
|---|---|---|
| Broad census | `uv run --offline python -m pytest -q` | **58 failed / 1417 passed** |
| Focused suites | `… pytest -q tests/test_{adapter,runner,admission,preparation,plan}.py` | **921 passed / 0 failed** |
| Lint | `ruff check src tests` | 2 findings, both `I001`, both pre-existing |
| Compile | `python -m compileall -q src tests` | exit 0, no output |
| Whitespace | `git diff --check 73ec822..HEAD` | exit 0, no output |

The census is byte-identical to the count recorded at `c444fcb`, so the two
documentation commits introduced no drift. `--fix` was **not** run on the two
`I001` findings; running a formatter or auto-fixer is Founder-gated by repo-root
`CLAUDE.md`.

**Every one of the 58 failures is in the absent-script class**, and this is now
measured rather than assumed. Grouping the failure list by file gives exactly
two files and no third:

| File | Failures |
|---|---|
| `tests/test_scripts_inert.py` | 51 |
| `tests/test_surface_contract.py` | 7 |

Both files gate on `scripts/prepare_topology_grant.py` and
`scripts/run_topology_rehearsal.py`, neither of which exists. The five focused
suites that do not touch `scripts/` are **wholly green at 921 passed**, up from
the 901 recorded at `3cd9d77` purely because later commits added tests. There
are therefore **zero unintended failures** at this HEAD.

Module line counts are unchanged from `c444fcb`, so the F16 hazard has not
moved: `adapter.py` 799, `preparation.py` 798, `grant.py` 794, `runner.py` 756,
all against the strict `>= 800` bound at `tests/test_surface_contract.py:236-247`.
`adapter.py` retains **one line** of headroom.

RUNTIME remains **HOLD**. Neither entrypoint script was executed; neither exists.

### `73ec822..0a50a4a` — full-range independent review sought and NOT obtained

Two independent read-only Opus reviews of the complete local range were launched
in this cycle — one on the authority / control-surface / fail-closed lens, one on
test effectiveness and vacuity — and **neither returned before the cycle's
timebox expired**. No verdict was reached, so none is recorded.

This section exists because an unrecorded attempt is indistinguishable from an
attempt never made, and this component has already lost finding detail twice that
way. The state it pins:

- The range `73ec822..0a50a4a` (36 commits) remains **PUSH-ELIGIBLE NO / RUNTIME
  HOLD**, unchanged.
- The last recorded verdict is still `817227b..a1a97f6` — NO-GO, 0/2/3/2.
- The four P1s the register at `c444fcb` lists as repaired-in-source but
  never independently reviewed — **F5/F29, F22, F23**, plus **F33** at
  NARROWED/PARTIAL — are still unreviewed. Nothing in this cycle discharged any
  of them, and the measured-gates section above must not be read as if it had.
  Green gates are not a verdict.
- **F3 remains AMBIGUOUS.** Its fate is tracked only through F22/F23, which have
  no verdict, so it cannot be resolved either way yet.

The next unused finding number is still **F36**; this cycle assigned none.

**Exact next action:** obtain the full-range independent verdict on
`73ec822..0a50a4a` and append it here with per-finding P0-P3 detail *before* any
repair or any GREEN. The atomic entrypoint GREEN stays blocked behind
P0=P1=P2=0, which the open P1 set alone currently forbids.

### `73ec822..c47bd86` — full-range independent review OBTAINED — **NO-GO**

The verdict the two previous cycles sought and did not obtain. Three independent
read-only Opus reviewers ran on disjoint scopes, plus one measurement verifier.
Each returned; none was assumed. Scopes were bounded deliberately, because two
prior single-reviewer attempts at "the whole range" exceeded their timebox and
lost their findings — the same failure mode this ledger already records twice.

| Lane | Scope | Verdict |
|---|---|---|
| A | F5/F29 repair (`8cc85de`, `77eb7e1`) | **GO** on F5/F29; P1 residual on F33 |
| B | F22/F23 repair (`e3d6116`) | **NO-GO** — both discharged, new P1 of same class |
| C | Production-source diff `73ec822..c47bd86` (127 lines, 4 files) | **NO-GO** — new P1 |
| D | Gate measurement at HEAD (verifier, not a verdict) | see table below |

**Range verdict: NO-GO. PUSH-ELIGIBLE NO. RUNTIME HOLD.**

#### Findings closed by this review

- **F5 / F29 — P1 — DISCHARGED (independently).** Shipped `src/` has exactly one
  attempt-identity derivation and it is grant-pinned on every path:
  `runner.py:331` calls `attempt_id_for(prepared.granted_observed_at)`, and
  `attempt_id_for` (`runner.py:286-307`) is a pure function of its argument.
  `granted_observed_at` is populated at `preparation.py:759` from the signed pin.
  Reviewer A searched for a surviving host read (`strftime`, `datetime.now`,
  `utcnow`, `time.time`, `gethostname`, `uname`, `getpid`, `uuid`, `socket.`) and
  found only the monotonic clock port and `grant.py:254`, neither of which names.
  `_attempt_names` has one call site (`runner.py:743`). The discharge is
  non-vacuous by measurement, not analysis: `8cc85de` contains no test file and
  flipped the two REDs 76p/2f → 78p/0f.
- **F22 — P1 — DISCHARGED.** `module_wide_offences`
  (`tests/test_scripts_inert.py:1391-1400`) folds `computed_attribute_reads(module)`
  over the whole module at `:1392-1395`, before the sink walk; the test calls that
  exact function at `:1469`, so assertion and effectiveness proof (`:1742`) run one
  path. Reviewer B re-ran the original recorded evasion and measured it flagged.
- **F23 — P1 — DISCHARGED.** `root_sinks:1355-1357` adds every `keyword.arg is None`
  value and `:1358-1365` every `ast.Dict` with constant key `repository_roots`.
  The recorded `**` splat evasion is now flagged twice, measured.
- **F3 — AMBIGUOUS → CLOSED.** F3's fate was tracked only through F22/F23
  (`:963-964`). Both are now independently discharged, so F3 closes with them.
  This is the explicit re-closure `:1247-1249` recorded as owed.
- **No control was weakened by `e3d6116`.** Its 20 deletions are the inline walk
  relocated verbatim plus two false docstring claims withdrawn in place
  (`:1806-1809`). No assertion removed, no floor lowered. The file is
  byte-identical from `e3d6116` to HEAD.

#### New findings — numbering continues at F36, no restart

- **F36 — P1 — CONFIRMED — `runner.py:331` vs `tests/test_runner.py:1246-1301`.**
  The entire semantic content of the F5/F29 repair is untested. Reverting
  `attempt_id_for(prepared.granted_observed_at)` to
  `attempt_id_for(prepared.image[OBSERVED_AT_KEY])` leaves the suite green.
  The sentinel test at `:1246` proves every created name *routes through* the seam
  but asserts nothing about *which field is fed to it*, and in the runner fixtures
  the two instants are equal — `fakes.IMAGE_OBSERVED_AT` (`fakes.py:85`) is both
  the grant pin (`documents.py:81`) and the default live host reading
  (`fakes.py:356`). Failure scenario: the exact drift `runner.py:295-305` says it
  exists to prevent regresses silently on the next edit, and is discovered only
  after the single authorized attempt is spent. The separating fixture already
  exists — `FRESH_OBSERVED_AT`, used at `tests/test_preparation.py:1400-1409` —
  and no runner test uses it. **Fix: one runner test driving**
  `passing_adapters(image=host_image(observed_at=FRESH_OBSERVED_AT))` **asserting
  created names carry** `SYNTHETIC_ATTEMPT_ID`. This is the highest-value next
  repair: it is small, test-only, and it is the difference between F5/F29 being
  discharged and F5/F29 being *durably* discharged.
- **F39 — P1 — CONFIRMED — `tests/test_scripts_inert.py:1299-1317`, false claim at
  `:1302-1304`.** `grant_derived_names` follows taint through module bindings only,
  never through the call-argument-to-parameter edge, so a grant-derived root
  laundered through a helper's parameter reaches `build_plan` with the guard
  silent. Reviewer B measured `sinks=3 / offences=[]` on a four-line source in
  which `_forward(authorization, _declared(authorization))` passes the root as
  `values`, a parameter, which is never a bound name and so never enters `derived`.
  This is F22/F23's class respelled in one extra line, and it directly refutes the
  docstring claim that "a helper calling a helper calling the envelope has to be
  followed to its end."
- **F43 — P1 — CONFIRMED — `tests/test_scripts_inert.py:1491-1495`.** The reviewed
  `CONFORMING_WIRING_SHAPE` — the design the entrypoint guards are pinned *not* to
  refuse — renders the attempt identity itself and bypasses the new seam. It hands
  `build_plan` the raw ISO instant `"2026-08-05T00:00:00Z"` while the runner
  renders `"20260805T000000Z-c8"` (`runner.py:307`). Failure scenario: an
  implementer follows the pinned reference design; the `:` characters are exactly
  what `ATTEMPT_INSTANT_FORMAT` strips because an argv token may not carry them, so
  either `exact_token` refuses at plan-build time or the plan carries
  `cybrik-topology-net-2026-08-05T00:00:00Z` against created
  `cybrik-topology-net-20260805T000000Z-c8` — and the single authorized attempt is
  spent on the exact refusal F29 was repaired to prevent. `77eb7e1` created the
  seam and did not update this shape.
- **F44 — P1 — CONFIRMED — `docs/ENTRYPOINT-SLICE-SPEC.md:146`.** The spec governing
  the absent entrypoint still says `attempt_id` is derivable "using the existing
  `runner._attempt_names` formula" — the *private* helper, taking a
  `PreparationResult` the wiring does not hold. `grep` for `attempt_id_for` across
  the spec and `tests/test_scripts_inert.py` returns **zero hits**. Failure
  scenario: the entrypoint GREEN is written against the spec, re-implements the
  formula, and `test_the_attempt_identity_format_is_rendered_in_exactly_one_place`
  cannot see it because `runner_tree()` (`tests/test_runner.py:1141`) parses
  `runner.py` only.
- **F40 — P2 — CONFIRMED — `tests/test_scripts_inert.py:1355-1357`.** The new splat
  shape refuses a splat carrying *no root at all*, only the attempt identity the
  grant is explicitly entitled to fix (`:1432-1438`, `:1754-1757`). Measured:
  `build_plan(repository_roots=dict(repository_roots), **identity)` is flagged.
  The `root_sinks` docstring (`:1343-1346`) discloses the honest-root-inside-a-splat
  cost but not this one — it forbids a spelling the reviewed design permits.
- **F41 — P2 — CONFIRMED — `tests/test_scripts_inert.py:1348-1372`.** `root_sinks`
  has no positional-argument shape; combined with F24's mutation hole, two honest
  decoy sinks satisfy the floor while the real root launders (measured
  `sinks=2 / offences=[]`). Held at P2 rather than P1 only because
  `plan.build_plan` is keyword-only (`plan.py:437-441`); any intermediate helper
  is unconstrained.
- **F37 — P2 — CONFIRMED — `observe.py:510` vs `tests/test_surface_contract.py:308-316`.**
  `CommandAdapterAccessors` is a new public module-level name, absent from
  `observe.__all__` and pinned by no test, because the `__all__` control is
  one-directional: it asserts every listed name resolves, never that every public
  name is listed. Contrast `attempt_id_for`, which is exhaustively pinned.
- **F42 — P3 — CONFIRMED — `tests/test_scripts_inert.py:1463-1467`.** The
  anti-vacuity comment claims the floor is met because "`main` names the roots to
  the wiring and the wiring names them to `plan.build_plan`", but the floor no
  longer counts named keywords specifically; the comment describes a stricter check
  than the code performs.
- **F38 — P3 — CONFIRMED — `observe.py:1-10` vs `:510-542`.** The module docstring
  still claims "Every function here is total and pure … holds nothing between calls
  and answers only from what it was handed", but the new `plan` property answers
  from `self._executor`, an attribute the class never defines and only `adapter.py`
  sets. The mixin is untyped against it, so no type checker can see the contract.

**F35 remains the last previously-assigned number. This review assigned F36-F44.
There are no gaps in F1..F44. The next unused finding number is `F45`.**

#### Existing findings re-measured against live source

| ID | Was | Now | Evidence |
|---|---|---|---|
| F30 | P2 | **P1 — escalated** | `preparation.py:220` `granted_observed_at: str = ""` is still the only `PreparationResult` field `__post_init__` (`:222-260`) does not validate. Escalated because the field is now load-bearing for the single authorized attempt's *name*, which it was not when F30 was filed. System still fails closed via `PrecheckAbort`, but the invariant "a satisfied snapshot names its authorization" is not enforced where it is stated. |
| F33 | NARROWED | **PARTIALLY DISCHARGED** | `77eb7e1` creates and exports the seam (`runner.py:81`) and AST-pins single-rendering *inside* `runner.py` (`tests/test_runner.py:1292-1294`). "Both callers reach it" is false: the second caller does not exist, and both artifacts that will author it (F43, F44) still direct the implementer to re-render by hand. |
| F16 | P2 | **CONFIRMED, counts re-measured** | `adapter.py` **799**, `preparation.py` **798**, `grant.py` **794**, against `MODULE_LINE_LIMIT = 800` with a strict `>=` at `tests/test_surface_contract.py:236-247`. `adapter.py` has **zero** lines of headroom. Consequence for entrypoint GREEN below. |
| F31 | P2 | **CONFIRMED — hid nothing** | Three multi-line statements in `preparation.py` were collapsed to one line each (`:243`, `:529`, `:557`), buying 6 lines against 7 added. Reviewer C verified each reflowed string is byte-identical in behaviour; nothing was smuggled in. The durable defect is not the reflow but module placement chosen by size bound rather than cohesion — `observe.py:530-533` states this outright. |
| F26 | P2 OPEN/WIDENED | **MEASURABLY WORSE** | `plan.build_plan(**{}, **{})` alone scores `sinks=2` and clears the `>= 2` floor at `:1467` with zero real root sinks. The two new shapes are the cheapest yet; any unrelated `**kwargs` call in the module now counts. |
| F24 | P2 | CONFIRMED-STILL-OPEN | `:1275-1296` — `.update()` is an `ast.Expr`; `module_bindings` has no branch for it, so the container never enters `derived`. Measured offences `[]`. |
| F25 | P2 | CONFIRMED-STILL-OPEN | `:1213` — `os.getenv("SUITE_ROOT")` and `os.path.dirname(sys.argv[0])` both reach a named `repository_roots=` sink with offences `[]`. |
| F27 | P3 | CONFIRMED-STILL-OPEN | `:1366-1371` — the `held` shape makes a whole `FunctionDef` the sink, so an honest `_control_roots` helper that also reads the grant for the permitted identity is flagged. Measured: a **false blocker**, two offences on honest source. |
| F28 | P3 | CONFIRMED-STILL-OPEN | `:1225-1232` — `builtins.getattr(authorization, FIELD)` and `operator.attrgetter("grant")(authorization)` both reach a named sink with offences `[]`. |
| F34 | P3 | unchanged | Denylist-coverage gap for `granted_observed_at`; not widened by these commits. |

#### Control properties over the production-source diff

| Property | Verdict | Evidence |
|---|---|---|
| Fail-closed | **UPHELD** | `runner.py:300-306` refuses every non-exact-UTC pin incl. `""`, `None`, non-`str`; `preparation.py:797` wraps `snapshot` in `guarded(...)`, so the unguarded subscript at `:759` degrades to a bounded refusal, not a raw `KeyError`. |
| Single spawn site | **UPHELD** | `adapter.py:222-251` remains the sole argv→runner site; the new mixin (`observe.py:510-542`) publishes only `.plan` and deliberately no `.runner`, pinned across the whole MRO by `tests/test_adapter.py:150-152`. |
| Anti-self-witnessing | **WEAKENED (structural only)** | `observe.py:60` now imports `.plan`, and `adapter.py:254,284,342,474,509` make all five command adapters inherit from a class defined in the *observation* module. The evidence-reduction layer is now an ancestor of the seam-holding layer. No behavioural bypass found, but **no control pins intra-package import direction** — `tests/test_surface_contract.py:36-50` has only `FORBIDDEN_LIBRARY_IMPORTS`. |
| Surface / inertness | **Inertness UPHELD, surface WEAKENED** | No import side effect, no cycle. Surface: F37. |
| Composition-root discipline | **UPHELD in-diff** | Nothing in the four files derives a control root or reads the environment; `attempt_id_for` is structurally pinned against clock/env/snapshot reads by `tests/test_runner.py:1123-1140`, `:1234`. System-wide it is **unassertable today** — the wiring module does not exist; that property is one of the 58 REDs. |
| Authority fields not defaulted | **WEAKENED** | F30, escalated above. |

**P0 band is empty across all three review lanes.** No permit-by-default path, no
second spawn site, no environment read, no removed assertion.

#### Gates measured at HEAD `c47bd86` (lane D, verifier)

Nothing was installed, auto-fixed or reformatted. `uv.lock` untouched.

| Gate | Command | Result |
|---|---|---|
| Broad census | `uv run --offline python -m pytest -q` | **58 failed / 1417 passed** in 0.64s |
| Failure classification | grouped by file | 51 `tests/test_scripts_inert.py` + 7 `tests/test_surface_contract.py` = 58 |
| Absent-script proof | `ls -la scripts/` | `No such file or directory` — the whole directory is absent |
| Focused suites | `… tests/test_{adapter,runner,admission,preparation,plan}.py` | **921 passed / 0 failed** |
| Lint | `ruff check src tests` | 2 findings, both `I001`, both pre-existing (`test_errors.py:12`, `test_runner.py:3`); `--fix` NOT run — Founder-gated |
| Compile | `python -m compileall -q src tests` | exit 0, no output |
| Whitespace | `git diff --check 73ec822..HEAD` | exit 0, no output |
| Worktree | `git status --short --branch` | ahead 37; sole untracked entry is `uv.lock` |

**Zero unintended failures.** All 58 are the absent-script class, measured by
exhaustive file breakdown summing to exactly 58, not assumed.

#### Consequence for the atomic entrypoint GREEN

The GREEN stays **blocked**: P1 ≠ 0. The open P1 set is **F30, F36, F39, F43, F44**.

Two further constraints the GREEN must respect when it is unblocked:

1. **Treat `adapter.py` as frozen.** At 799 lines against a strict `>= 800` bound it
   has zero headroom — one added line, comment or import fails the gate. The wiring
   contract `tests/test_scripts_inert.py:830,1005` asserts
   (`wiring.command_adapters[name].plan is wiring.plan`) is already satisfied by the
   mixin, so the GREEN should not *require* touching `adapter.py`. If
   `test_runtime_wiring_completes_the_injected_adapter_surface` or
   `test_the_default_execute_path_constructs_exactly_one_process_executor` forces an
   `adapter.py` edit, the size gate converts the GREEN into an immediate RED
   clearable only by relocating code — the same pressure that produced F31.
2. **F43 and F44 must be repaired before the GREEN, not by it.** They are the two
   artifacts that will author the second caller, and both currently instruct the
   implementer to re-render the identity formula by hand. Landing the GREEN against
   them reintroduces F5/F29 in the script, where
   `test_the_attempt_identity_format_is_rendered_in_exactly_one_place` cannot see it.

**Exact next action:** repair **F36** test-first — one runner test driving
`passing_adapters(image=host_image(observed_at=FRESH_OBSERVED_AT))` and asserting
the created names carry `SYNTHETIC_ATTEMPT_ID`. It must be RED against a runner
reverted to the live reading and GREEN against shipped source. It is the smallest
open P1, it is test-only, and until it lands the independently-granted F5/F29
discharge is silently revertible.

RUNTIME remains **HOLD**. Neither entrypoint script was executed; neither exists.

## Open non-technical items for the Founder

- `integration/topology-rehearsal/uv.lock` is untracked and un-ignored in
  this worktree, pending a dependency decision. See repo-root `CLAUDE.md`:
  dependency installation is Founder-gated.

## Ledger maintenance

Append new rows/sections above rather than editing prior ones, except to
fix factual errors. Do not relabel any past verdict as IMPLEMENTED,
VERIFIED, or GA — this ledger records review verdicts on code, not
runtime or production status.

---

## Cycle-18 repair record — F36 refuted by measurement, F43 repaired

Measured in this worktree at `9f8bfa7` plus the working-tree edits described below.
Nothing was executed: no entrypoint script exists and none was run. `uv.lock`
untouched.

### F36 — REFUTED. The claim it rests on is false under measurement.

F36 asserts that "reverting `attempt_id_for(prepared.granted_observed_at)` to
`attempt_id_for(prepared.image[OBSERVED_AT_KEY])` leaves the suite green", and
concludes that the F5/F29 discharge is silently revertible. The revert was performed
and measured; it is not.

Two spellings of that revert exist and they measure differently:

| Revert spelling | `pytest -q tests/test_runner.py` | What it measures |
|---|---|---|
| `prepared.image[OBSERVED_AT_KEY]` — the review's literal text | **62 failed / 34 passed** | Nothing about coverage. `OBSERVED_AT_KEY` is defined in `preparation.py:86` and is *not* imported into `runner.py`; the revert is a `NameError` on every run. |
| `prepared.image["observed_at"]` — the honest revert | **3 failed / 93 passed** | The real drift. |

The three honest-revert failures are:

- `test_a_host_observed_after_the_grant_pin_still_creates_names_the_plan_accepts[one-second-later]`
- `test_a_host_observed_after_the_grant_pin_still_creates_names_the_plan_accepts[fifty-nine-seconds-later]`
- the new witness added below.

The first two are **pre-existing at `9f8bfa7`** (`tests/test_runner.py:1013`, present
in `git show HEAD:` before any edit this cycle). They drive
`plan_bound_adapters(observed_at)` with an admitted observation strictly later than
the grant pin, assert `plan.attempt_id == fakes.SYNTHETIC_ATTEMPT_ID` first so the
comparison cannot be vacuous, and then assert each created name equals the
plan-carried name. That is exactly the separating property F36 says nothing states.
The review reached its conclusion from the fixture equality
`fakes.IMAGE_OBSERVED_AT == documents` grant pin without performing the revert; the
equality holds, but `plan_bound_adapters` overrides the live reading, so the
inference does not.

**F36 status: REFUTED — no repair owed.** The F5/F29 discharge is durable, and was
durable before this cycle.

### One witness added anyway — `tests/test_runner.py:1304`

`test_created_names_carry_the_granted_pin_not_this_host_s_live_observation` is kept
as a second, independent witness of the same property. It is not a repair and is not
claimed as one. It differs from the pre-existing pair in what it depends on: it uses
plain `fakes.passing_adapters(image=fakes.host_image(observed_at=...))` and compares
the created names against the `fakes` name constants directly, so it states the
naming property without routing through `plan_bound_adapters` or the plan builder.
If a future edit changes how the plan-bound fixture derives its own expectations, the
property survives in a test that does not use it.

- RED against the honest revert (third failure above); GREEN against shipped source.
- `src/` is byte-identical to `9f8bfa7` after the experiment: `git diff -- src/` is
  empty. The revert existed only in the working tree during measurement.

### F43 — REPAIRED. `tests/test_scripts_inert.py:1486`

`CONFORMING_WIRING_SHAPE` — the reference design the entrypoint guards are pinned
*not* to refuse — now renders the attempt identity through the exported seam instead
of forwarding the grant's raw ISO instant:

- added `from runner import attempt_id_for`;
- `attempt=authorization.grant[...]["observed_at"]` became
  `attempt_id=attempt_id_for(authorization.grant[...]["observed_at"])`.

Both halves were wrong, and the keyword name is the second half F43 did not name:
`plan.build_plan` (`plan.py:437-441`) takes `attempt_id`, not `attempt`, and passes
it through `exact_token`, which refuses the `:` characters a raw ISO instant carries.
An implementer following the old shape would have re-rendered the identity by hand at
a site `test_the_attempt_identity_format_is_rendered_in_exactly_one_place` cannot see,
*and* handed the plan a keyword it does not accept.

The shape's leading comment now states why the identity is not spelled out there.

**Evidence:**

| Gate | Command | Result |
|---|---|---|
| Conforming-shape guard | `pytest -q …::test_the_spec_conforming_wiring_shape_is_not_flagged_by_the_module_wide_guard` | **1 passed** — the repaired shape is still not flagged; `root_sinks >= 2` and `module_wide_offences == []` both hold |
| Runner suite | `uv run --offline python -m pytest -q tests/test_runner.py` | **96 passed / 0 failed** |
| Broad census | `uv run --offline python -m pytest -q tests/` | **58 failed / 1418 passed** — failure count unchanged from `9f8bfa7`; passed count is +1, the witness above |

No control was weakened to obtain this: the repair adds a call to the single renderer
and corrects a keyword; it removes no assertion and relaxes no guard.

### Open P1 set after this cycle

**F30, F39** remain open and unrepaired. **F36** is refuted. **F43** is discharged.
**F44** is addressed in the entry that follows this one.

### F44 — REPAIRED. `docs/ENTRYPOINT-SLICE-SPEC.md:146`

The spec's obstacle-2 passage told the implementer that `attempt_id` is derivable
"using the existing `runner._attempt_names` formula" — a private helper taking a
`PreparationResult` the composition root does not hold, which is an instruction to
re-render the identity by hand at a site
`test_the_attempt_identity_format_is_rendered_in_exactly_one_place` cannot see
(it parses `runner.py` only). It now names the exported seam, states that the root
must call `runner.attempt_id_for` directly with the grant's pinned
`observed_image_identity.observed_at`, and states explicitly that it must not reach
for `_attempt_names`.

The passage was the only one in the spec instructing an attempt-identity derivation;
`_attempt_names`, `attempt_id`, `ATTEMPT_INSTANT_FORMAT`, `formula` and `observed_at`
were all searched. The `image_reference` half was left as-is: it is a different field
with no seam pinned for it, and widening it is not F44.

**Evidence:** doc-only change; broad census `58 failed / 1418 passed`, unchanged.

### Net effect on the GREEN gate

F43 and F44 — the two artifacts the previous review required to be repaired *before*
the GREEN, because both would have authored a second rendering of the identity — are
both discharged. The open P1 set is now **F30** (authority-bearing pinned instant is
an unvalidated defaulted field, `preparation.py:220`) and **F39** (`grant_derived_names`
does not follow taint across the call-argument-to-parameter edge,
`tests/test_scripts_inert.py:1299-1317`). P1 ≠ 0, so the GREEN stays blocked, and
these repairs have not been independently reviewed.

RUNTIME remains **HOLD**. No entrypoint script exists and none was executed.

## Cycle 19 — F39 repaired test-first

### F39 — REPAIRED. `tests/test_scripts_inert.py`, commit `5bef003`

The module-wide root-derivation guard followed taint only to names the *module*
binds. A parameter never acquires a module name, so a helper that returns its own
parameter carried the grant to the sink across an edge `grant_derived_names` could
not see. The four-line shape independent review measured is now pinned in
`EVADING_WIRING_SHAPES` as `parameter-laundered-root`:

```python
def _declared(authorization):
    return authorization.grant["repositories"]


def _wire(values):
    return plan.build_plan(repository_roots=values)


def build_runtime_wiring(*, authorization, repository_roots):
    return _wire(_declared(authorization))
```

**Intended RED, measured before the repair, not assumed.** At `25aadc0` this shape
cleared the guard's own floor — `len(root_sinks(module)) >= 2` passed — and then
`module_wide_offences(module)` returned `[]`. The failure was
`AssertionError: parameter-laundered-root: this evasion is not flagged`, raised at the
offence assertion rather than at the floor. That ordering matters: a shape flagged
only because it is too small to reach the floor would have proved nothing about the
derivation walk, and the guard's effectiveness proof asserts the floor first for
exactly that reason.

**The GREEN.** `call_parameter_bindings` pairs every parameter of a module-level `def`
with the argument handed to it at each call whose callee is a literal `Name`;
`argument_pairs` performs the matching, including `*args`/`**kwargs` call sites, which
cannot be matched positionally and are therefore paired with *every* parameter of the
callee rather than none. `grant_derived_names` now iterates its fixed point over
`module_bindings(module) + call_parameter_bindings(module)`. In the shape above,
`values` enters `derived` because `_declared` is already in it, and the sink — the bare
name `values` — is then flagged.

**Nothing was widened that could invent a sink.** The parameter edge feeds derivation
only. `root_sinks`, `module_bindings`, `computed_attribute_reads` and
`forbidden_origins` are unchanged; the diff against `25aadc0` touches only the new
helpers, the `grant_derived_names` body line and docstring, and the new evasion entry.

**Residual limits, stated rather than hidden.** Only a callee spelled as a literal
`Name` matching a `def` in the same module is resolved — an aliased callee is caught by
the module-name walk instead (`aliased-helper`) <!-- CORRECTED: the clause "an aliased
callee is caught by the module-name walk instead (`aliased-helper`)" is FALSE about the
shipped tree. Independent measurement (ledger cycle 28-29, F47) showed the aliased case
MISSED, with an identical un-aliased control CAUGHT, isolating the alias as the sole
cause. F47 remains open. The same false claim in the `call_parameter_bindings` docstring
was already corrected in source; this prose sentence is corrected here, discharging the
P3 opened at ledger line 2857. -->, and a callee obtained at runtime is
outside what any static walk over this file can claim. Parameters are pooled by bare
name across the module, so one derived `values` argument derives every parameter named
`values`. That is an over-approximation, which for a fail-closed guard is the safe
direction, and it is recorded here so a future false positive is read as this decision
rather than as a new defect.

**Evidence:**

| Gate | Command | Result |
|---|---|---|
| Intended RED (at `25aadc0`) | `pytest -q tests/test_scripts_inert.py -k "recorded_evasion or conforming_wiring_shape"` | **1 failed / 1 passed** — floor passed, `module_wide_offences == []` |
| GREEN (at `5bef003`) | same command | **2 passed** — the evasion is flagged and the conforming shape is still not |
| Broad census | `uv run --offline pytest -q` | **58 failed / 1418 passed** — count unchanged from `25aadc0` |
| Failure distribution | `pytest -q \| grep ^FAILED \| sed 's/::.*//' \| uniq -c` | **51 `test_scripts_inert.py` + 7 `test_surface_contract.py`** — the recorded absent-script set, unchanged |
| Lint | `uv run --offline ruff check .` | **2 errors**, both pre-existing `I001`; no `--fix` was run |
| Compile | `uv run --offline python -m compileall -q src tests` | clean |
| Lockfile | `git status --short` | `uv.lock` untracked and untouched |

RUNTIME remains **HOLD**. No entrypoint script exists and none was executed.

### Independent review status of `5bef003`

A full independent Opus review of the F39 repair was commissioned this cycle with an
explicitly adversarial brief — reproduce the RED at the parent commit, construct
further parameter-edge launderings (keyword, `*args`, `**kwargs`, two-hop, defaulted,
nested), hunt false positives against the conforming shape and against honest wirings,
and check `argument_pairs` against real Python binding for crashes. It had not returned
a verdict before the cycle closed, so **F39's repair is recorded as measured but not
independently reviewed**, exactly as F43/F44 were left. It is owed before any push, and
the open P1 set for the GREEN gate is judged only after it lands.

## Cycle 20 — measured census at `cdb1f70`, before this cycle's edits

Measured on a clean tree (`git status --short` showed only the untracked `uv.lock`)
at HEAD `cdb1f70`, which is 44 commits ahead of the pushed PR #55 tip `73ec822`.

| Gate | Command | Result |
|---|---|---|
| Broad census | `uv run --offline python -m pytest -q` | **58 failed / 1418 passed** in 0.64s |
| Lint | `uv run --offline ruff check .` | **2 errors**, both pre-existing `I001`; `--fix` was NOT run |
| Compile | `uv run --offline python -m compileall -q src tests` | clean |
| Lockfile | `git status --short` | `uv.lock` untracked and untouched |
| PR #55 | `gh pr view 55` | OPEN, **draft**, CLEAN; four rendered checks SUCCESS at `73ec822` |

The 58/1418 total is unchanged from cycle 19 and from `25aadc0`. The per-file failure
distribution was **not** re-measured on a clean tree this cycle — the census capture was
truncated to its tail before the split was taken, and by the time that was noticed a
writer lane was already editing the tree. The cycle-19 split (51 `test_scripts_inert.py`
+ 7 `test_surface_contract.py`) is therefore carried as prior evidence, not re-measured
here. It is re-measured in the cycle-20 closing entry below.

RUNTIME remains **HOLD**. No entrypoint script exists and none was executed.

## Cycle 21 — F30 repaired test-first; both owed reviews commissioned

### Live state reconciliation at cycle open

The checkpoint handed to this cycle named HEAD `76553f4` and a range of 11 commits. Live
`git status --short --branch` reported **45 ahead** at HEAD `3bdc578`, with a *dirty* tree
carrying an uncommitted, unmeasured F30 repair left in flight by cycle 20's timeout. Live
state was taken as authoritative. PR #55 is unchanged: OPEN, **draft**, CLEAN, four rendered
checks SUCCESS at the pushed tip `73ec822`.

### F30 — REPAIRED. `preparation.py` + `tests/test_preparation.py`, commit `3e9bba6`

`PreparationResult.granted_observed_at` was declared `str = ""`. The default made "no pin was
proved" a constructible state of a class whose one documented state is a proof.
`runner.attempt_id_for` (`runner.py:331`) renders the single authorized attempt's name out of
this field, so a result carrying the default would have named no attempt, and the disagreement
would have surfaced only once that one attempt had already been spent.

**The repair.** The default is withdrawn, making the field mandatory. `__post_init__` now
refuses anything that is not the exact UTC instant the grant signed:

```python
if type(self.granted_observed_at) is not str or instant(self.granted_observed_at) is None:
    raise ValueError(...)
```

Eleven rejected values are pinned as `UNPINNED_INSTANTS`: empty, whitespace, trailing space,
prose, `+00:00` in place of `Z`, an impossible month, unpadded fields, an already-rendered
identity, `None`, an int, and a `str` subclass. The subclass case is included because
`frozen()` refuses safe-scalar subclasses outright (`preparation.py:125-133`) while a subclass
still parses as an instant — a snapshot documented as a complete immutable record may not hold
one value the same module would refuse to copy.

A **field-inventory pin** is added alongside, mirroring the one `tests/test_admission.py:803`
holds over the independent fact record. Its absence is precisely what let `granted_observed_at`
be added to the class earlier without `result_fields()` or any coherence parametrisation
noticing.

**Intended RED, measured against the parent's source rather than assumed.** The parent's
`preparation.py` was read out with `git show cdb1f70:...` into a /tmp scratch tree — no
checkout, stash or reset was used, and the working tree was never reverted — and the new tests
were run against it: **12 failed / 296 passed**. The twelve are the eleven `UNPINNED_INSTANTS`
parametrisations plus `test_the_pinned_instant_is_mandatory_rather_than_defaulted`.

**Honestly stated limit of that RED.** `test_the_result_field_inventory_is_exactly_the_proved_field_set`
and `test_the_pinned_instant_reaches_the_snapshot_from_the_signed_document` **passed** at the
parent. They are controls, not RED evidence: the field already existed and `snapshot()` already
copied the signed instant. They are recorded here as controls so a later reader does not count
them as proof of the repair.

**Single construction site.** `grep` over `src` and `tests` finds exactly one
`PreparationResult(` construction, `preparation.py:737`, which sets the field at `:760` from
`document["observed_image_identity"][OBSERVED_AT_KEY]`. No caller relied on the withdrawn
default.

**Evidence:**

| Gate | Command | Result |
|---|---|---|
| Intended RED (parent source in /tmp) | `pytest -q tests/test_preparation.py` | **12 failed / 296 passed** |
| GREEN (at `3e9bba6`) | `pytest -q tests/test_preparation.py` | **308 passed** |
| Broad census | `uv run --offline python -m pytest -q` | **58 failed / 1433 passed** in 0.64s |
| Failure distribution | `... \| grep ^FAILED \| sed 's/::.*//' \| sort \| uniq -c` | **51 `test_scripts_inert.py` + 7 `test_surface_contract.py`** — the recorded absent-script set, unchanged |
| Lint | `uv run --offline ruff check .` | **2 errors**, both pre-existing `I001`, in `tests/test_errors.py:12` and `tests/test_runner.py:3` — neither file touched this cycle; `--fix` was NOT run |
| Compile | `uv run --offline python -m compileall -q src tests` | clean |
| Lockfile | `git status --short` | `uv.lock` untracked and untouched |

The census total rose from 1418 to 1433 passed by exactly the 15 new tests. The failed count
and its per-file split are unchanged, so nothing outside `test_preparation.py` moved.

### Independent review status

Both owed reviews were commissioned this cycle as separate, non-overlapping adversarial Opus
lanes, each read-only and each forbidden from touching the working tree or the lockfile:

- **F39** (`5bef003`, the call-argument-to-parameter taint edge) — carried over from cycle 19,
  where it was commissioned but did not return before the cycle closed. Brief: reproduce the RED
  at `25aadc0`, hunt further parameter-edge launderings, hunt false positives against honest
  wirings, and crash-test `argument_pairs` against real Python binding forms. Findings are
  numbered from **F45**.
- **F30** (`3e9bba6`, this cycle's repair) — brief: hunt values that `instant()` accepts but that
  are not the signed instant, test whether shape validation without *agreement* validation is a
  real gap, verify the `frozen()` subclass claim, regression-hunt the withdrawn default, and
  attack the new tests for vacuity against a deliberately broken implementation. Findings are
  numbered from **F60**.

Until both verdicts are recorded below, **F30 and F39 are measured but not independently
reviewed**, exactly as F43/F44 were left. The open P1 set for the GREEN gate is judged only
after both land. The GREEN remains blocked.

RUNTIME remains **HOLD**. No entrypoint script exists and none was executed. Nothing was pushed;
PR #55 stays draft at `73ec822`.

### F39 independent verdict — NO-GO. `5bef003`. P0=0 P1=4 P2=3 P3=3

The adversarial Opus review commissioned this cycle returned **after** the cycle-21 entry above
was written. Its verdict is recorded here verbatim in substance rather than left in a transcript,
which is how the F43/F44 and cycle-19 verdicts were previously lost.

**What the review confirmed by measurement, not by reading the ledger:**

- The intended RED reproduces at `25aadc0` **at the offence assertion**, not at the floor:
  `AssertionError: parameter-laundered-root: this evasion is not flagged`, `assert [] != []`,
  raised at `tests/test_scripts_inert.py:1776`, with the floor passing at `sinks=3`. `1 failed,
  1 passed`. Reproduced in `/tmp/f39red` from `git show` plus only the new `EVADING_WIRING_SHAPES`
  entry — no checkout, no stash, no revert.
- GREEN at `5bef003`: `2 passed, 51 deselected`.
- **Nothing that can invent a sink was widened.** Nine guard functions are AST-identical across
  `25aadc0`→`5bef003`: `root_sinks`, `module_bindings`, `computed_attribute_reads`,
  `forbidden_origins`, `name_reads`, `attribute_reads`, `getattr_calls`, `literal_getattr_name`,
  `module_wide_offences`.
- **No crash.** 17 call/def binding forms through `call_parameter_bindings` and
  `grant_derived_names` produced no traceback, so the crash-hunt P1 hypothesis is refuted.
- Census measured `58 failed / 1433 passed`, failures identical to the recorded split; the +15
  passes are this cycle's `test_preparation.py` additions, not a discrepancy in `5bef003`.

**Why NO-GO despite that.** The verdict is not against the mechanism. It is against the *claim of
closure*: the `call_parameter_bindings` docstring asserts a compensating control that measurement
contradicts, and the commit introduces two false positives the parent guard did not have.

| ID | Sev | Location | Defect | Reproducing shape |
|---|---|---|---|---|
| F45 | **P1** | `argument_pairs`, 1342-1371 | Parameter **defaults** are a binding edge and are not modelled | `def _wire(values=os.environ["CONTROL_ROOT"]): return plan.build_plan(repository_roots=values)` + `_wire()` → `sinks=3`, MISSED |
| F46 | **P1** | `call_parameter_bindings`, 1332-1334; disclosure 1320-1324 | Attribute-spelled callees skipped, and the docstring's claim they are "caught by the module-name walk instead" is **false for methods** | `_Wiring().wire(_declared(authorization))` MISSED; `@staticmethod` `_Wiring.wire(...)` MISSED |
| F47 | **P1** | same | Aliased callee **compounded with** parameter laundering; the pinned `aliased-helper` shape aliases a *grant-reading* helper and does not cover this | `_alias = _wire` then `_alias(_declared(authorization))` → MISSED |
| F48 | **P1** | `functions = {...}`, 1326-1330 | `functions` is a last-wins dict over `ast.walk`, so any later def or method of the same name replaces the signature and the new edge is silently disabled | working `_wire(values)` + `class _Other: def _wire(self, ignored)` → MISSED (CAUGHT without the class) |
| F49 | P2 | 1326-1330 | `lambda` helpers not collected (`FunctionDef`/`AsyncFunctionDef` only) | `_wire = lambda values: plan.build_plan(repository_roots=values)` → MISSED |
| F51 | P2 | 1357-1363 | A positional argument **after** a `*splat` is paired by syntactic index, which is not where Python binds it | `def _wire(first, second, values)` + `_wire(*prefix, _declared(authorization))` → taint pairs to `second`, MISSED |
| F52 | P2 | 1358-1359 | **New false positive vs parent.** `*splat` pairs every parameter, so an honest tuple carrying both roots and a legitimate grant-derived attempt id taints the root parameter | `_wire(*arguments)` → FLAGGED at `5bef003`, **clean** at `25aadc0` |
| F53 | P2 | 1331-1339 | **New false positive vs parent.** Bare-name parameter pooling: an honest helper reusing a generic parameter name for the attempt id taints an unrelated helper's root parameter | `_identity(value)` + `_wire(value)` → FLAGGED at `5bef003`, **clean** at `25aadc0` |
| F50 | P3 | 1332-1334 | Indirect callee unresolved; arguably outside static reach | `functools.partial(_wire)(...)` → MISSED |
| F54 | P3 | 1347-1351 | Dead condition: `if argument is not None` over `positional + kwonlyargs`; `ast.arg` is never `None` | static read |
| F55 | P3 | 1299-1300, 1381-1385 | Docstrings say "module-level `def`" but `ast.walk` also registers nested and class-scoped defs; over-approximating (safe) but inaccurate, and it is the mechanism behind F48 | `def f(a): def f(b): return b; return f(a)` binds `b` |

**The correction this ledger owes.** Cycle 19's "Residual limits" paragraph above states that an
aliased callee "is caught by the module-name walk instead (`aliased-helper`)" and presents the
bare-name pooling as a *hypothetical* future false positive. F46/F47 measure the first claim false
for methods and for the alias-plus-parameter composition, and F52/F53 measure the second as an
actual regression against `25aadc0`. That paragraph and the `call_parameter_bindings` docstring at
1320-1324 both overclaim and must be corrected.

**Minimum to reach GO on F39:** pin F45, F46 and F48 into `EVADING_WIRING_SHAPES` (they fail there
now), or explicitly defer them *and* correct the two overclaiming disclosures. F52/F53 need either
narrowing or an explicit statement that the repair regressed two honest shapes.

**Limits of the review, as stated by the reviewer.** The guard is today exercised only through the
pinned source strings — the real `run_topology_rehearsal.py` does not exist, so
`test_no_control_root_anywhere_in_the_wiring_module_derives_from_the_grant` is one of the 51
absent-script failures. The census was taken on the dirty tree before this cycle's commits. No
entrypoint, Docker, install or `ruff --fix` was run; F1-F44 were not re-audited; no coverage was
taken.

**Consequence for the GREEN gate.** The open P1 set is now **F45, F46, F47, F48** (F39's repair) plus
whatever the F30 review returns. P1 ≠ 0, so the GREEN stays blocked and nothing is pushable.
RUNTIME remains **HOLD**.

## Cycle 22 — F48 repaired test-first; the owed F30 verdict landed **NO-GO**

### Live state reconciliation at cycle open

HEAD `8529f9a`, branch 48 commits ahead of `origin`. PR #55 is OPEN, draft, MERGEABLE at
`73ec822`, four rendered hosted checks SUCCESS (two `secret-scan`, two `contract standards
validation`). The untracked `integration/topology-rehearsal/uv.lock` was preserved untouched.

Broad census measured on the clean tree at `8529f9a` before any edit:
**58 failed / 1433 passed in 0.65s** — 51 in `test_scripts_inert.py`, 7 in
`test_surface_contract.py`, all of them the intended absent-entrypoint-script REDs.
Re-measured after this cycle's edit: **58 failed / 1433 passed**, unchanged.

### F48 — REPAIRED. `tests/test_scripts_inert.py`, commit `c56518f`

The signature table in `call_parameter_bindings` was a last-wins dict over `ast.walk`, so any
later `def` or method sharing a name replaced the real signature and disabled the
call-argument-to-parameter taint edge for that name entirely.

- **RED, at the offence assertion and not at the floor**:
  `AssertionError: shadowed-helper-signature: this evasion is not flagged`, `assert [] != []`,
  `tests/test_scripts_inert.py:1891`. `1 failed, 52 deselected`. The `root_sinks(module) >= 2`
  floor passed for the shape, so the shape is judged by the derivation walk.
- **GREEN**: `1 passed, 52 deselected` after collecting *every* signature registered under a name
  and unioning the resulting pairs — the fail-closed over-approximation direction, matching the
  function's existing deliberate conservatism.
- **Non-vacuity proved**: the entry FAILS against the pre-fix dict and PASSES after, with the
  anti-vacuity floor satisfied in both runs.
- **Collateral**: `test_runner.py test_adapter.py test_preparation.py` → **770 passed**.
  Whole file → 51 failed / 2 passed, all 51 carrying the absent-script message. `compileall` clean.
  `ruff` is **absent** from `.venv/bin`; it was not run and was not installed.
- **Nothing widened**: the nine AST-pinned guard functions (`root_sinks`, `module_bindings`,
  `computed_attribute_reads`, `forbidden_origins`, `name_reads`, `attribute_reads`,
  `getattr_calls`, `literal_getattr_name`, `module_wide_offences`) are untouched.

### The overclaiming disclosure F39's review demanded — CORRECTED

The `call_parameter_bindings` docstring claimed an aliased or attribute-spelled callee "is caught
by the module-name walk instead (`aliased-helper`)". Independent review measured that FALSE for
methods and for the alias-plus-parameter composition. The paragraph now states the measured limit
and names **F45** (parameter defaults), **F46** (attribute/method callees) and **F47** (aliased
callee compounded with parameter laundering) as OPEN and explicitly NOT closed here.

### F30 independent verdict — NO-GO. `3e9bba6`. P0=0 P1=2 P2=1 P3=2

The review commissioned in cycle 21 returned this cycle. Recorded here in substance, verbatim in
its findings, so it cannot be lost the way the cycle-19 and F43/F44 verdicts were.

| ID | Sev | Location | Defect | Reproducing shape |
|---|---|---|---|---|
| F60 | **P1** | `tests/test_preparation.py:773-779` | `test_the_pinned_instant_reaches_the_snapshot_from_the_signed_document` is **VACUOUS** for its stated purpose. Its docstring says "the instant the grant signed, not a live host reading", but `tests/fakes.py:356` is the single `observed_at` in the fakes, so grant pin and live host reading are the same string | Mutation M7 — `snapshot()` sourcing `observed.image[OBSERVED_AT_KEY]` instead of `document["observed_image_identity"][OBSERVED_AT_KEY]` — **survives all five new tests**; only 3 pre-existing `test_runner.py` tests fail |
| F61 | **P1** | `src/.../preparation.py:260-262` | The validator is **shape-only, not agreement**. The commit claims it "refuses anything that is not the exact UTC instant the grant signed"; measured, it accepts *any* well-formed instant. Nothing checks the pin against the instant the authorization carries outside `snapshot()`'s own literal wiring | `dataclasses.replace(result, granted_observed_at="1970-01-01T00:00:00Z")` yields a `satisfied=True` "complete proof"; `runner.attempt_id_for` then renders `19700101T000000Z-c8`, and every container/network/volume/credential name derives from it. Also accepted: `0001-01-01T00:00:00Z`, `9999-12-31T23:59:59Z`, `2026-08-05T00:00:01Z` |
| F62 | P2 | `src/.../preparation.py:202-203` | The "complete immutable snapshot" docstring is refuted for this field by three routes; `frozen=True` blocks only plain `setattr` | `object.__setattr__(r, "granted_observed_at", ...)` SUCCEEDS; `r.__dict__[...] = ...` SUCCEEDS; `class Sub(PreparationResult): def __post_init__(self): pass` constructs with `granted_observed_at=""` |
| F63 | P3 | `tests/test_preparation.py:700-707` | The new comment attributes the `str`-subclass refusal to `frozen()` at `preparation.py:125-133`, but `granted_observed_at` never passes through `frozen()`; the refusal comes solely from `type(...) is not str` at line 260 | Mutation M4 (`is not str` → `not isinstance`) is killed by the `str-subclass` param, proving the type check is the control |
| F64 | P3 | `tests/test_preparation.py:709-721` | `UNPINNED_INSTANTS` holds only shape-invalid values and no accepted-but-wrong control, so it cannot detect widening from "the signed instant" to "any instant" (the F61 gap); it also duplicates the corpus at `tests/test_runner.py:~1100-1118` | Adding `pytest.param("1970-01-01T00:00:00Z")` makes the test fail against the shipped implementation |

**What the F30 repair genuinely does close, measured fairly.** Mandatory-ness is real and tested
(M3, restoring the `= ""` default, is killed by `test_the_pinned_instant_is_mandatory_rather_than_defaulted`
and 10 pre-existing tests). Shape validation is real (M1 validator deleted, M2 no-op validator,
M5 `instant()` check dropped, M6 type check dropped — all killed). Subclass refusal is real (M4
killed). The field-inventory pin is not decoration: adding a twelfth defaulted field fails
`test_the_result_field_inventory_is_exactly_the_proved_field_set`.

**Hypotheses the reviewer REFUTED rather than dropped**: the withdrawn default broke no caller —
`PreparationResult(` appears exactly once in `src/` and the only same-commit test change is a
legitimate fixture extension; unicode digits, leap seconds, `+00:00`, lowercase `z` and whitespace
are all rejected by the strftime round-trip; the census claim of 58/1433 was independently confirmed.

**Reviewer-stated limits.** No `admission.py` or entrypoint measurement; no runtime, Docker,
listener or network action; `ATTEMPT_SLICE` and plan-bound port derivation not audited for their
own agreement check; strftime `%Y` below year 1000 probed only at four boundaries; the ledger was
treated as untested claim throughout.

### Open P1 set after this cycle

**F45, F46, F47** (F39's repair, F48 now closed) and **F60, F61** (F30's repair). P1 ≠ 0, so the
atomic entrypoint GREEN stays blocked and nothing is pushable. F61 is the most consequential open
item: a shape-only pin lets a forged instant name the attempt that every container, network,
volume and credential name derives from.

Nothing was pushed. PR #55 stays draft at `73ec822`. RUNTIME remains **HOLD** — no entrypoint
script exists and none was executed.

## Cycle 24 — F60/F61 repaired test-first; the independent verdict is **NO-GO**

### Live state reconciliation at cycle open

HEAD `d30def9`, branch 50 commits ahead of `origin`. PR #55 is OPEN, draft, `CLEAN` at
`73ec822`, four rendered hosted checks SUCCESS (two `secret-scan`, two `contract standards
validation`). The working tree carried an uncommitted F60/F61 repair, which this cycle measured
and committed as `42d6d02`. The untracked `integration/topology-rehearsal/uv.lock` was preserved
untouched and is still the only entry in `git status --short`.

Broad census at `42d6d02`: **58 failed / 1444 passed in 0.63s**. The 58 are unchanged from
cycle 22 and were independently reclassified this cycle: 51 in `test_scripts_inert.py`, 7 in
`test_surface_contract.py`; by missing artifact, 49 `run_topology_rehearsal.py`,
8 `prepare_topology_grant.py`, 1 missing `scripts/` directory. Every one carries the
absent-entrypoint message. The passed count rose 1433 → 1444 on this cycle's 11 new tests.

### The repair, measured. `42d6d02`

`PreparationResult` now carries `granted_image_identity` — the signed host observation the pin
was drawn from — and `__post_init__` requires the pin to equal that identity's `observed_at` and
the live `image` reading to be at or after it.

- **RED against the shipped parent**: **11 failed, 1 passed**. The five forged-pin copies and the
  stale-reading copy DID NOT RAISE; the five carried-identity cases had no field to set. The one
  pass is the F60 test, whose non-vacuity is proved separately.
- **F60 non-vacuity**: mutation M7 — `snapshot()` sourcing `observed.image[OBSERVED_AT_KEY]` —
  survived all five of that test's assertions before and is **killed** now, independently
  re-measured (`1 failed`). `fakes.LATER_HOST_OBSERVED_AT = "2026-08-05T00:00:30Z"` genuinely
  diverges from `IMAGE_OBSERVED_AT`.
- **GREEN**: **781 passed** across `test_preparation.py test_runner.py test_adapter.py`.
  `compileall -q src tests` clean. `ruff` is **absent** from `.venv/bin`; it was not run and was
  not installed.
- **Size bound**: `preparation.py` stays at **799** lines against a strictly-under-800 bound. The
  seven added lines were paid for by collapsing seven multi-line error-message calls. Recorded,
  not hidden — see **F70**.

### Independent verdict on `42d6d02` — **NO-GO. P0=0 P1=1 P2=4 P3=2**

| ID | Sev | Location | Defect | Reproducing shape |
|---|---|---|---|---|
| F65 | **P1** | `preparation.py:260-263` | `granted_image_identity` is pinned to the real authorization **only** in `snapshot()` (759). `__post_init__` checks pin == identity's `observed_at` — an internal consistency check between two caller-supplied fields. Moving **both** sides lands the exact F61 forgery again. No other consumer re-pins either field: the only ones are `runner.py:331 attempt_id_for(prepared.granted_observed_at)` and admission `grant.py:682-688`, which windows the *document's* signed instant and the *live* reading, never `granted_observed_at` | `F="1970-01-01T00:00:00Z"`; `replace(r, granted_image_identity=MappingProxyType({**dict(r.granted_image_identity), "observed_at": F}), granted_observed_at=F)` → **ACCEPTED**; `attempt_id_for` then names the attempt off 1970 |
| F66 | P2 | `preparation.py:260` | The new field has **no shape contract** — `.get(OBSERVED_AT_KEY)` is all that is read — so a "signed host observation" may be a one-key stub bearing no registry or host identity, and cannot be the evidence the docstring at 214-219 claims | `replace(r, granted_image_identity=MappingProxyType({"observed_at": F}), granted_observed_at=F)` → **ACCEPTED** |
| F67 | P2 | `preparation.py:264-270` | A satisfied result may have `image` disagreeing with `granted_image_identity` on **every** one of the six `OBSERVED_BINDING_KEYS`; only `observed_at` is related. `image_findings` compares them, but that judgement lives in `prepare` — precisely the "no copy goes through it" gap this commit claims to close. `runner._attempt_names` renders `image_reference` from `prepared.image`. Contained in the full runner path by `grant.py:461-478`, hence P2 | for each of `repository, tag, platform, index_digest, manifest_digest, local_image_id`: `replace(r, image=MappingProxyType({**dict(r.image), key: "FORGED-"+key}))` → all six **ACCEPTED** |
| F68 | P2 | `tests/test_preparation.py:449` | The new field's **deep-freeze enforcement is unpinned**. Deleting `"granted_image_identity"` from `FROZEN_MAPPING_FIELDS` survives the entire suite unchanged. The amended test only asserts the snapshot `prepare()` built is immutable, which `snapshot()`'s `frozen()` guarantees regardless of the tuple, so it never exercises the validator | remove `"granted_image_identity",` from `preparation.py:105` → `58 failed, 1444 passed`, the baseline |
| F70 | P2 | `preparation.py` (799) vs `test_surface_contract.py:95,246` | **Booby trap.** The module sits one line under a strictly-under-800 bound, held there by 7 hand-collapsed calls. Nothing in either file records the coupling; the next author who adds one line, or runs a formatter, breaks a test unrelated to their change. The collapsed closing-paren style is non-idiomatic and an autofixer would silently revert it | `wc -l` → 799; `MODULE_LINE_LIMIT = 800` compared with `>=`. The formatter arithmetic (7 collapses → ≥806) is **arithmetic, not measured** — `ruff` is absent |
| F69 | P3 | `tests/test_preparation.py:855-870` | Two of the five `..._may_not_disagree` params do not test the control they name: `[one-second-after]` and `[far-future]` pass via the **ordering** check, not the equality check, and stay green when equality is reverted to shape-only | revert 261 to `... or instant(self.granted_observed_at) is None:` → `8 failed, 2 passed`; the 2 passing are those params |
| F71 | P3 | `preparation.py:212` | `@dataclass(frozen=True)` invariants remain bypassable by `object.__setattr__`, `copy.copy(r).__dict__[...]=`, and a subclass with a no-op `__post_init__` that still satisfies `isinstance`. **Pre-existing and inherent, not a regression from this commit** — recorded so it is not re-raised as new. Supersedes F62 as the standing statement | `@dataclass(frozen=True) class Sub(PreparationResult): def __post_init__(self): pass` → constructs with `granted_observed_at=F` |

### Disposition of the two findings this cycle set out to close

- **F60 — genuinely CLOSED**, by measurement: M7 is killed, and the divergent host reading is real.
- **F61 — NARROWED, not closed.** The literal reproducer now raises and mutations M1 (8 kills) and
  M2 (1 kill) die. But the defect *class* survives as **F65**: a two-field `replace` carrying a
  self-consistent, wholly invented identity is accepted, including the epoch value F61 named. The
  commit message's claim that "agreement is provable *here*, in every copy of a result" is
  **false**: what a copy proves is self-consistency, not agreement with anything the authorization
  signed. That sentence overclaims and must be corrected when F65 is repaired.

### Hypotheses the reviewer REFUTED by measurement — do not re-raise

1. *The 34-line reformat changed behaviour.* Refuted by a recursive `co_consts` diff of the
   compiled parent and child modules: the only string deltas are the three intentionally new
   messages; every other literal, including the rewrapped `image_findings` stale message, folds
   byte-identical. Rendered outputs of `ephemeral_findings` (3 branches),
   `platform_evidence_findings`, `image_findings` (stale branch), `guarded` and `projected` are
   identical old-vs-new.
2. *The two collapsed single-element tuples degenerated into bare strings.* Refuted — trailing
   commas retained; both still return 1-tuples.
3. *`granted_image_identity` is not deep-frozen.* Refuted at HEAD: a proxy holding a live dict
   raises `granted_image_identity is not a deep proof`. The *enforcement* being untested is a
   different claim — that is F68.
4. *The census is wrong.* Refuted, with the 58 independently reclassified (see above).
5. *The 781 GREEN claim is wrong.* Refuted. (The commit message says "adapter**s**"; the file is
   `test_adapter.py`.)
6. *The `compileall` / `ruff` claims are wrong.* Refuted: `compileall` clean, `ruff` genuinely absent.
7. *The new forged-pin and stale-reading tests are vacuous.* Refuted: M1 killed by 8 of 10, M2 by
   the stale-reading test.

### Reviewer-stated limits

Static only — no entrypoint script, Docker, listener, network, installer or formatter was run, so
F70's line arithmetic is unmeasured. `admission.py`, `grant.py`, `observe.py`, `plan.py` and
`adapter.py` were read only at the call sites reachable from `granted_observed_at`,
`granted_image_identity` and `prepared.image`; F67's containment by admission was confirmed to
exist at `grant.py:461-478` but not exhaustively verified. No mutation testing of the ~307
pre-existing `test_preparation.py` tests or of any other file beyond M7/M1/M2/M3. No coverage was
taken. No downstream repository was reviewed for the new field's contract visibility. F65 has no
in-repo caller today — `runner.run_topology_rehearsal` calls `prepare()` directly — and was graded
P1 because the repair itself adopts the "results get copied" threat model and claims to close it.

### Open P1 set after this cycle

**F45, F46, F47** (F39's repair) and **F65** (this repair; supersedes F61, which is narrowed).
F60 is closed. P1 ≠ 0, so the atomic entrypoint GREEN stays blocked and nothing is pushable.

Nothing was pushed. PR #55 stays draft at `73ec822`. RUNTIME remains **HOLD** — no entrypoint
script exists and none was executed.

## Cycle 26 — F65/F66/F67 repaired test-first; the independent review is **NOT YET OBTAINED**

### Live state reconciliation at cycle open

HEAD `09da45d`, branch 52 commits ahead of `origin`. PR #55 is OPEN, draft, `MERGEABLE` at
`73ec822`, four rendered hosted checks SUCCESS (two `secret-scan`, two `contract standards
validation`). The working tree carried an uncommitted F65/F66/F67 RED plus a move of
`IMMUTABLE_LEAVES`/`immutability_findings` out of `preparation.py` into `observe.py`. The
untracked `integration/topology-rehearsal/uv.lock` was preserved untouched.

### The measured RED

Against the shipped parent, `tests/test_preparation.py` was **20 failed / 324 passed**: the six
reading-drift copies, the six identity-drift copies, five of the six bare-stub identities and the
three two-field invented-identity copies all DID NOT RAISE. The `empty` stub param and both
`..._deep_frozen_by_the_validator...` params passed already — the first via the existing pin
check, the latter two via `FROZEN_MAPPING_FIELDS`, which is what F68 asked to have pinned.

### The repair

`signed_identity_findings(identity, image)` refuses a pinned identity that is not a whole,
resolved, agreeing host observation: exact key inventory (F66), no unresolved value, registry
digest shape on both registry digests and `local_image_id`, platform shape, and equality with the
live reading on every one of the six `OBSERVED_BINDING_KEYS` (F67). `observed_at` is deliberately
excluded — two readings are two events. `__post_init__` calls it, so every copy of a result goes
through it, not only `snapshot()`'s wiring.

**The residual is unchanged and is stated, not implied.** A copy holds no authorization, so
nothing here proves the identity is the one a grant signed. F65's two-field forgery is made
**expensive**, not impossible: the invented identity must now carry the whole reviewed inventory,
well formed, and match the live reading on every binding. F65 is therefore **NARROWED**, and any
claim that it is closed would be false.

### Measured GREEN

- Focused `test_preparation.py test_runner.py test_adapter.py`: **806 passed**.
- Broad census at this commit: **58 failed / 1469 passed in 0.67s**. The 58 are the unchanged
  absent-entrypoint REDs; passed rose 1444 → 1469 on this cycle's 25 new tests.
- `compileall -q src tests` clean. `ruff` remains **absent** from `.venv/bin`; it was not run and
  was not installed.

### F70 (the 799-line booby trap) discharged by measurement, not by collapsing lines

Adding the validator to `preparation.py` took it to **801** — over the strictly-under-800 bound,
exactly as F70 predicted. It was **not** paid for by hand-collapsing more calls. The function was
moved to `observe.py`, which owns the findings-reader family and had headroom. `preparation.py` is
now **771** and `observe.py` **626**, so both sit well clear of the bound.

> **Corrected at cycle 27 by F73.** The `observe.py` figure above is the count at `7d1b00b`, the
> intermediate commit, not at the tip. At `0f6883f` the measured count is **624**. `preparation.py`
> **771** is correct at both. Both remain strictly under the 800 bound.

### F72 — a real symbol collision the move exposed. **P2. Repaired in the same commit.**

`observe.py` already defines its own `OBSERVED_IDENTITY_KEYS` — **five** keys — while `grant.py`
exports a **seven**-key tuple of the same name. Importing grant's into `observe.py` silently
rebound it to the local five-key meaning, and the validator then refused every genuine identity:
measured **99 failed** in `test_runner.py`, with `prepare()` aborting at `snapshot`. The suite does
detect a regression here, but at `7d1b00b` no test *named* the hazard, so a future reader saw a
cascade rather than a collision. Recorded as owed.

> **Corrected at cycle 27 by F73.** The paragraph above described the `7d1b00b` state, in which the
> import was aliased `OBSERVED_IDENTITY_KEYS as SIGNED_IDENTITY_KEYS`. That alias no longer exists.
> The undescribed follow-up commit `0f6883f` deleted both the alias and `observe.py`'s own five-key
> tuple, so `observe.OBSERVED_IDENTITY_KEYS is grant.OBSERVED_IDENTITY_KEYS` — one name, one
> seven-key meaning — and added `tests/test_observe.py:629`, which names the hazard by comparing
> the two modules' shared uppercase names for disagreement. `observe.SIGNED_IDENTITY_KEYS` does
> **not** exist at the tip; a reader grepping for it will correctly find nothing.

### What this cycle did NOT do

No independent Opus review of this repair was obtained — the cycle's measurement and the F72
detour consumed the budget. **The repair is therefore unreviewed and unpushable.** Commissioning
it is the next cycle's first action, before any further repair.

### Open P1 set after this cycle

**F45, F46, F47** (F39's repair) and **F65** (narrowed, not closed). P1 ≠ 0, so the atomic
entrypoint GREEN stays blocked and nothing is pushable.

Nothing was pushed. PR #55 stays draft at `73ec822`. RUNTIME remains **HOLD** — no entrypoint
script exists and none was executed.

## Cycle 27 — the owed independent review of `09da45d..0f6883f` landed **GO**, and F73 corrected

### Live state reconciliation at cycle open

HEAD `0f6883f`, branch **54** commits ahead of `origin`. The supplied checkpoint was stale: it named
HEAD `76553f4` and 11 ahead. PR #55 is OPEN, draft, `MERGEABLE`, still at `73ec822`, four rendered
hosted checks SUCCESS (two `secret-scan`, two `contract standards validation`). The untracked
`integration/topology-rehearsal/uv.lock` was preserved untouched. Nothing was pushed this cycle.

### Measured at `0f6883f` before any edit — coordinator's own measurement, not the reviewer's

- Broad census: **58 failed / 1471 passed in 0.66s**. All 58 are the unchanged absent-entrypoint
  REDs in `test_scripts_inert.py` and `test_surface_contract.py`. No unintended failure.
- Focused `test_preparation.py test_runner.py test_adapter.py test_observe.py`: **912 passed**.
- `compileall -q src tests` clean. `ruff` remains **absent** from `.venv/bin`; not run, not installed.
- File sizes, all strictly under the 800 bound: `adapter.py` 799, `grant.py` 794, `preparation.py`
  771, `runner.py` 756, `admission.py` 725, `observe.py` **624**, `plan.py` 533.

### Independent verdict on `09da45d..0f6883f` — **GO. P0=0 P1=0 P2=3 P3=2**

Cycle 26 closed with its repair unreviewed and therefore unpushable. That debt is now discharged.
An independent Opus reviewer, given the range plus live source and told to treat every cycle-26
ledger claim as unverified, returned GO on the code with five findings, none of which is a security
or authority defect. The findings are recorded in full below because two prior reviews lost detail.

### F73 — P2 — `docs/REVIEW-LEDGER.md:2543` and `:2535`. **REPAIRED this cycle.**

The cycle-26 record described a repair that is not in the shipped tree. It stated the collision was
fixed by aliasing `OBSERVED_IDENTITY_KEYS as SIGNED_IDENTITY_KEYS`, but the follow-up commit
`0f6883f` deleted both that alias and `observe.py`'s local five-key tuple, and `0f6883f` had **no
ledger entry at all**. It also recorded `observe.py` at **626**; the tip measures **624** — 626 was
the intermediate `7d1b00b` state. A reviewer grepping for `SIGNED_IDENTITY_KEYS` would find nothing
and could not tell whether the alias was deliberately superseded or the collision had silently
returned. Both paragraphs now carry an inline correction naming the real tip state. This was the
reviewer's stated must-fix-before-push item.

### F74 — P2 — `tests/test_observe.py:629`. **OPEN.**

The collision test's docstring claims "one name, one meaning, **package-wide**", but the test
compares only `observe` against `grant`, and only for `isupper()` names. The reviewer measured
**three surviving unequal same-name collisions**: `grant.RECORD_KEYS` (2 keys) vs
`admission.RECORD_KEYS` (10), `constants.EVIDENCE_KEYS` (11) vs `admission.EVIDENCE_KEYS` (5), and
`grant.tool_findings` vs `preparation.tool_findings` — two different functions, lowercase, invisible
to this test even if aimed at the right module pair. `admission.py:52` **already** imports from
`grant`, so adding `RECORD_KEYS` to that import line reproduces F72 exactly. `grant`/`admission`
`PLATFORM_KEYS` and `adapter`/`plan` `CONTROL_OBSERVATIONS` are equal-but-duplicated silent-drift
candidates. The docstring overclaims its own scope; either the claim narrows or the test widens.

### F75 — P2 — `src/cybrik_suite_topology_rehearsal/observe.py:263`. **OPEN. Highest-value next repair.**

`signed_identity_findings` validates the *identity* inventory exhaustively but reads the live
reading only through `image.get(key)` for the six binding keys. It validates neither `image`'s own
key inventory nor `image["present"]`, both of which `image_findings` (`preparation.py:568,572`)
enforces at `prepare()` time. Measured: `replace(result, image=MappingProxyType({**dict(result.image),
"present": False}))` **constructs successfully**, as does dropping `present` altogether, as does
`replace(result, selected_image_identity=MappingProxyType({}))`. The result then asserts
`satisfied is True` while its own reading says the reviewed material is not on the host, and
`runner.py:262` strips `PRESENT_KEY` before recording, so the contradiction never reaches the
evidence record. Cycle 26 enumerated "the six reading-drift copies" as the closed set; the seventh
field and the inventory check were out of scope with no residual note. It is P2 rather than P1
because the reviewer measured exactly one `PreparationResult(` construction in `src/` and **zero**
`dataclasses.replace` calls in `src/` — the control is defence-in-depth, not a live path.

### F76 — P3 — `src/cybrik_suite_topology_rehearsal/observe.py:273`. **OPEN.**

`keyed(identity, OBSERVED_IDENTITY_KEYS, label, ordered=False)` is laxer than `grant.py:464`, which
checks the identical inventory with `ordered=True`. Measured: a seven-key `granted_image_identity`
in reversed order is accepted by `__post_init__` but refused by `grant.keyed`. A result may carry a
"signed host observation" the grant module would reject.

### F77 — P3 — `src/cybrik_suite_topology_rehearsal/observe.py:75`. **OPEN.**

`observe.__all__` is pinned by `test_observe.py:604` to exactly five reducers, yet
`preparation.py:50-54` imports three symbols not in it (`IMMUTABLE_LEAVES`, `immutability_findings`,
`signed_identity_findings`). A refactor trusting the pinned `__all__` could rename or remove
`signed_identity_findings` with the surface contract and its test both staying green while
`preparation` breaks — the same declared-meaning-vs-actual-dependency class F72 was about.

### Claims the reviewer VERIFIED TRUE — do not re-audit

- `signed_identity_findings` is called from `__post_init__` at `preparation.py:234`, after the
  `FROZEN_MAPPING_FIELDS` type gate at `:200-204`, so both `identity` and `image` are guaranteed
  `MappingProxyType` and there is no `AttributeError` escape hatch. Every `dataclasses.replace`
  copy is validated.
- `OBSERVED_BINDING_KEYS` is six keys, `observed_at` is correctly absent, and the comparison at
  `observe.py:288-292` iterates all six.
- F65 is **NARROWED, not closed**, exactly as cycle 26 stated: a two-field copy moving `image` and
  `granted_image_identity` together to an unobserved digest is still accepted. The disclosure is
  honest.
- `observe.OBSERVED_IDENTITY_KEYS is grant.OBSERVED_IDENTITY_KEYS` → `True`. No shadowing name
  remains **in `observe.py`**; the surviving collisions are in other module pairs (F74).

### Hypotheses the reviewer REFUTED by measurement — do not re-raise

- `validate_image_identity` was **not** silently weakened by the `OBSERVED_IDENTITY_KEYS` →
  `REGISTRY_IDENTITY_KEYS` swap: `grant.REGISTRY_IDENTITY_KEYS` is byte-identical to the deleted
  local five-tuple. Behaviour unchanged.
- No circular import. `grant` imports only `constants`; `observe` imports `grant`/`plan`/`protocols`;
  neither imports `preparation`.
- `immutability_findings` was moved **verbatim**; only its docstring expanded.
- `copy.copy` does skip `__post_init__`, but forging through it still requires `object.__setattr__`,
  which defeats every frozen-dataclass control in the file equally and predates this change.
  `pickle` fails outright on `mappingproxy`. Not attributable to this cycle.

### Reviewer-stated limits

Not checked: `ruff`/`mypy` (absent, nothing installed); the 58 RED entrypoint failures beyond
confirming they are unchanged and unrelated; any runtime, Docker, PKI or network behaviour (none
executed, no entrypoint exists); `admission.py` and `runner.py` beyond the symbol-collision and
`present`-consumer questions; the earlier range `73ec822..09da45d` except where it defines imported
symbols; **F45/F46/F47** (the open F39-repair P1s), untouched by this diff and not re-verified;
coverage percentages, not measured.

### Open P1 set after this cycle — unchanged

**F45, F46, F47** (F39's repair) and **F65** (narrowed, not closed). This cycle's review returned
P1=0 *for its own range* and closed cycle 26's review debt; it did not touch the pre-existing P1s.
P1 ≠ 0 overall, so the atomic entrypoint GREEN stays blocked and nothing is pushable.

### Next action

Repair **F75** test-first — validate `image`'s own key inventory and `present` in
`signed_identity_findings`, so a copy cannot assert `satisfied is True` over a reading that says the
reviewed material is absent. Then re-measure and commission the next independent review.

Nothing was pushed. PR #55 stays draft at `73ec822`. RUNTIME remains **HOLD** — no entrypoint script
exists and none was executed.

## Cycle 28-29 — F75's repair landed at `47dce0e` unrecorded; this cycle measured and reviewed it

### Live state reconciliation at cycle open

HEAD `47dce0e37b8cc058163e56b50c6aa55245ecd0f4`, branch **56** commits ahead of `origin`. The
supplied checkpoint was stale again — it named HEAD `76553f4` and 11 ahead — and the ledger's last
entry stopped at cycle 27's `0f6883f`. The intervening commit `47dce0e`, the F75 repair, carried
**no ledger entry and no independent review**: cycle 28 committed it and then hit its 600-second
timeout. Cycle 27 had recorded that commissioning that review was the next cycle's first action.
That debt is what this cycle discharges.

PR #55 is OPEN, draft, `CLEAN`, still at `73ec822`, four rendered hosted checks SUCCESS (two
`secret-scan`, two `contract standards validation`). The untracked
`integration/topology-rehearsal/uv.lock` was verified present at 4674 bytes and left untouched.
Nothing was pushed.

### `47dce0e`'s own measurement claims, independently re-measured — all seven CONFIRMED

The commit message makes seven measurable claims. A verifier that did not write the commit re-ran
every one of them against live source and reported exact numbers. This matters because two earlier
cycles recorded claims that were false about the shipped tree; a commit message is not evidence
until someone else runs it.

| Claim | Claimed | Measured | Verdict |
|---|---|---|---|
| Focused suite | 927 passed | **927 passed, 0 failed** | CONFIRMED |
| Broad census | 58 failed / 1486 passed, all absent-entrypoint REDs | **58 failed / 1486 passed**; every `FAILED` line is in `test_scripts_inert.py` or `test_surface_contract.py` and nowhere else | CONFIRMED |
| Intended RED | 13 failed / 452 passed with pre-repair sources restored | **13 failed / 452 passed** | CONFIRMED |
| `compileall -q src tests` | clean | exit 0, no output | CONFIRMED |
| `observe.py` size | 676, under the 800 bound | **676**; no `src` file reaches 800, the largest being `adapter.py` at 799 | CONFIRMED |
| Whitespace hygiene | (implied) | `git diff --check 0f6883f..47dce0e` exit 0, no output | CONFIRMED |
| Tree state | (implied) | `git status --short` shows only the untracked `uv.lock` | CONFIRMED |

The intended-RED check is the one worth spelling out, because a repair whose tests pass against the
*pre*-repair source proves nothing. The verifier copied the package to `/tmp/f75check`, restored
`observe.py`, `preparation.py` and `runner.py` from `0f6883f` — confirming byte-identity against
`git show` for all three — left the tests at HEAD, and measured 13 failures. All 13 are tests added
by `47dce0e`'s own diff:

- `test_observe.py` (7): `test_the_host_reading_inventory_is_declared_in_exactly_one_module`;
  `test_a_signed_identity_is_refused_against_a_reading_that_denies_the_material` in its four
  parametrisations `present-false`, `present-unread`, `present-truthy-not-true`,
  `present-truthy-string`; `..._missing_its_presence_answer`; `..._carrying_an_unreviewed_key`.
- `test_preparation.py` (6): `test_a_proved_result_may_not_carry_a_reading_that_denies_its_own_material`
  in its five parametrisations including `unreviewed-extra-key`; `..._with_no_presence_answer`.

The commit's phrase "all 13 the tests added here" is exact, not approximate. Two further tests added
by the same commit — `test_a_signed_identity_agreeing_with_a_whole_host_reading_is_accepted` and
`test_a_genuine_proved_result_is_still_copyable_unchanged` — are positive controls and correctly
pass on both sides. That is the right result: without them, a reducer that refused *every* reading
would look exactly as green as one that refuses only self-contradicting readings.

No unintended failure, no regression outside the two known-RED files, and no discrepancy of any kind
between the commit's stated numbers and the re-measured ones.

### `ruff` remains absent

`ruff` is still not in `.venv/bin`. It was not run and was **not installed** — installing it needs a
dependency decision this lane does not hold. Lint therefore remains unrun, as in every prior cycle.

### The open P1 set re-audited against live source — all four STILL REAL, all four over-graded

`F45`, `F46`, `F47` and `F65` have blocked every GREEN for several cycles and none had been
re-verified since it was opened. An independent auditor re-derived all four at HEAD by measurement,
importing the shipped helper from `tests/test_scripts_inert.py` rather than a copy, and building a
genuine `prepare()` result through `tests/conftest.py`. Probe code lives in `/tmp/f45probe/`; nothing
in the repository was edited.

**Every one of the four reproduces. None is refuted.** What changed is the grade, and the grade
change is *proposed*, not applied — see the caveat below.

| Finding | Status at HEAD | Measured | Proposed grade |
|---|---|---|---|
| F45 parameter defaults | STILL-REAL | `module_wide_offences=[]` → MISSED, both host- and grant-origin spellings; positive control with the value passed as an argument → CAUGHT | P3 |
| F46 attribute/method callees | STILL-REAL | instance-method and `@staticmethod` callees both MISSED; cause measured, not inferred — `call_parameter_bindings` skips any callee that is not `ast.Name`, though `functions` already holds the method's signature | P2 |
| F47 aliased callee + parameter laundering | STILL-REAL | MISSED; control B, identical but un-aliased, → CAUGHT, isolating the alias as sole cause | P3 |
| F65 multi-field `replace` forgery | STILL-REAL, **broader than disclosed** | two-field epoch forgery ACCEPTED, `attempt_id_for` → `19700101T000000Z-c8`; **three-field** forgery moving `granted_image_identity` + `image` together to a wholly invented self-agreeing binding also ACCEPTED, `image.repository='attacker/exfil'`, `satisfied=True` | P2 |

**Why no longer P1: no live bypass exists for any of the four.** F45/F46/F47 are gaps in a *test
helper* whose subject file `run_topology_rehearsal.py` does not exist — the guard is one of the 58
absent-script REDs, so today the walk is exercised only against pinned strings. For F65 the auditor
measured exactly one `PreparationResult(` construction in `src/` (`preparation.py:708`) and **zero**
`dataclasses.replace` calls anywhere in `src/`; `runner.run_topology_rehearsal` calls `prepare()`
directly. F65's P1 grade rested explicitly on the repair "claiming to close" the copy threat model,
and at HEAD the source itself withdraws that claim — `signed_identity_findings`' docstring now states
that a copy carries no authorization and enumerates the `selected_image_identity` gap as open.
Grading that P2 under F75 while grading F65 P1 for the same shape is inconsistent.

**What HEAD does now refuse, measured** — the F66 bare one-key stub; identity-only drift on a single
binding key; `image["present"]=False`, which is the F75 repair working; and any pin later than the
live reading. **Still accepted:** `selected_image_identity=MappingProxyType({})`, exactly as the F75
residual paragraph admits.

#### F65's disclosed scope was too narrow and is corrected here

The ledger described F65 as a *two-field* forgery. The auditor measured a **three-field** variant in
which `granted_image_identity` and `image` move together to an invented binding — `attacker/exfil`,
a fabricated `local_image_id` — with `satisfied=True`. The forged identity must satisfy the HEAD
validators (seven-key inventory, no `None`, registry-digest shape, a well-formed platform *object*
rather than the string `"linux/amd64"`), but that is a formatting cost, not an authority cost.

F65 cannot be closed inside the dataclass: a copy holds no authorization, so any witness a validator
could check is itself replaceable, and `__post_init__` can only prove self-consistency. The repair
that makes the forgery **inert** is at the single consumer — `runner._attempt_names` (defined `:310`,
called `:743`) should take the `authorization` already in scope at `:742` and derive the attempt
instant from `authorization.grant["observed_image_identity"]["observed_at"]`, the same expression
`preparation.snapshot()` uses at `preparation.py:732`, instead of from `prepared.granted_observed_at`
at `runner.py:331`. Explicitly rejected alternative, reasoned through and recorded so it is not
re-attempted: making `granted_observed_at` a derived property only shrinks the forgery from two
fields to one, because the ordering check still admits any past instant.

#### The three helper repairs are prototype-verified together

Wrapping the shipped helper in-process without touching the repository, all three evasions plus both
controls go CAUGHT; **all 11 currently pinned `EVADING_WIRING_SHAPES` stay CAUGHT**; and
`CONFORMING_WIRING_SHAPE` stays clean, so there is no new false positive against the reviewed design.
Smallest repairs, all three in `tests/test_scripts_inert.py`, `call_parameter_bindings`:

- **F45** — a signature-only pass emitting `(parameter, default_expression)` for every default.
  `signature.defaults` right-aligns against `posonlyargs + args`; `kw_defaults` aligns element-wise
  with `kwonlyargs`, skipping `None`. It must sit in the walk over `FunctionDef`/`AsyncFunctionDef`,
  **not** in `argument_pairs`, so a defaulted helper never called by a literal `Name` is still
  derived.
- **F46** — key the `functions` lookup on `node.func.id` for `ast.Name` and `node.func.attr` for
  `ast.Attribute`. For the attribute branch do **not** reuse the positional index: a bound `self`
  shifts every index by one and would reintroduce the F51 misalignment class. Pair fail-closed
  instead — union every parameter name with every argument and keyword value at that call site.
- **F47** — fold module-level function aliases into the `functions` table, iterating **to a fixed
  point** so chained aliases converge; a single pass is order-dependent under `ast.walk` and silently
  misses half the chains.

#### The re-grade is PROPOSED, not APPLIED — the GREEN gate stays shut this cycle

One independent auditor's severity opinion is not a discharge. Re-grading four findings out of P1
is precisely the move that would let this slice declare a gate open it has not earned, and the gate
exists to stop that. The re-grade is recorded as reasoned and measured, and it requires a **second
independent confirmation** before the P1 set is treated as empty. Until then the open P1 set is
unchanged — **F45, F46, F47, F65** — P1 ≠ 0, the atomic entrypoint GREEN stays blocked, and nothing
is pushable.

#### Auditor-stated limits

Not run: `ruff`, `mypy` (absent). Not executed: any entrypoint, Docker, listener, network or PKI path
— none exists. Not re-verified: F48-F55, F66-F77, F1-F44. For F65 only `granted_image_identity`,
`granted_observed_at`, `image` and `selected_image_identity` were attacked; the other
`PreparationResult` fields were not swept for replace-forgeability, and `object.__setattr__` /
`copy.copy` / subclass bypasses (F71, pre-existing) were not retested. The `admission.py:461-478`
containment the ledger credits for F67 was not verified. No downstream repository was reviewed.

### Also owed, and not obtained this cycle

The independent review of `0f6883f..47dce0e` itself was commissioned in parallel and had not returned
when the cycle closed. `47dce0e` therefore remains **measured but unreviewed, and unpushable**.
Commissioning it again is the next cycle's first action, before any repair.

### Two ledger defects this audit exposed

- `docs/REVIEW-LEDGER.md:2096-2098` still asserts that "an aliased callee is caught by the module-name
  walk instead (`aliased-helper`)". Independent measurement has since shown that false, and line 2286
  records the correction as owed, but the original sentence still carries no inline correction. **P3,
  open.** The same false claim in the `call_parameter_bindings` docstring **is** already corrected at
  HEAD — that limb of F46 is closed.
- F65's recorded scope understated the defect, as corrected above.

### Next action

Repair **F46** test-first — the widest of the three helper gaps, since one method-spelled wiring
helper disables the entire call-parameter taint edge and a class-based wiring module is an ordinary
design rather than a contrivance. F45 and F47 are edits to the same function with the same test-first
pattern, so one cycle can land all three. Then obtain the still-owed independent review of
`0f6883f..47dce0e`, and a second independent opinion on the proposed re-grade.

Nothing was pushed. PR #55 stays draft at `73ec822`. RUNTIME remains **HOLD** — no entrypoint script
exists and none was executed.

### CORRECTION to the section above — the owed review DID land, and it is **NO-GO**

The paragraph "Also owed, and not obtained this cycle" was written and committed at `564a4e4` while
the review was still in flight. It returned shortly afterwards. **That paragraph is withdrawn as
false**, and this section replaces it. The review was obtained.

### Independent verdict on `0f6883f..47dce0e` — **NO-GO. P0=0 P1=1 P2=1 P3=3**

The reviewer answered all eight commissioned questions by measurement. Seven of the eight came back
clean and are recorded under "verified true" below. The eighth found that the control this commit
*added* is itself bypassable.

#### F78 — **P1** — `src/cybrik_suite_topology_rehearsal/observe.py:292`. **OPEN. Blocks push.**

One field, three access protocols. `local_presence_findings` reads the presence answer through
`image[PRESENT_KEY]` — `__getitem__`. `keyed` (`observe.py:324`) validates the inventory by
*iteration*. The sibling binding comparison (`observe.py:341/344`) reads through `image.get(key)`.
The `__post_init__` type gate at `preparation.py:200-204` accepts anything whose `type()` is exactly
`MappingProxyType`, and a `MappingProxyType` wrapping a **`dict` subclass** satisfies that gate
exactly. Such a subclass stores `present: False` — visible to `.items()`, to `.get()`, and therefore
to `runner._observed_identity` (`runner.py:262`) and every downstream consumer — while answering
`True` to the single accessor the new control uses. Measured:

```
type is MappingProxyType : True
stored value (items())   : False
liar.get('present')      : False
liar['present']          : True
immutability_findings    : ()
keyed inventory          : ()
local_presence_findings  : ()
signed_identity_findings : ()
>>> replace(result, image=liar) ACCEPTED. satisfied = True
>>> present = False  / .get -> False
```

The result asserts `satisfied is True` over a reading that *stores* "not on this host" — precisely
the scenario `47dce0e`'s message says it closed. This is **not** the sanctioned `object.__setattr__`
hatch: it passes `__post_init__` and every declared type gate rather than skipping them. Subclass
smuggling is inside this codebase's own stated threat model — `preparation.frozen()` explicitly
refuses subclasses of safe scalars, commenting that one "may carry mutable state of its own" —
`__post_init__` simply does not defend it. Stated so it can be regraded honestly: `prepare()`'s live
path is **immune**, because `snapshot()` passes `frozen(observed.image)` and `frozen` rebuilds the
mapping from `.items()`, normalising any subclass into a plain dict in a fresh proxy. The bypass is
reachable only via `dataclasses.replace` — which is exactly the defence-in-depth path every new test
in this commit models, so the finding lands squarely inside the repair's own claimed scope.

#### F79 — **P2** — `observe.py:289`. **OPEN.**

The new docstring asserts the inventory "is checked by `keyed` … before this is reached; calling
this on an unchecked mapping would raise rather than report." Inaccurate about the shipped tree:
passing `keyed` does not make `image[PRESENT_KEY]` readable, because `keyed` only iterates. A proxy
over a `dict` subclass that raises on `__getitem__("present")` passes `keyed` cleanly and then throws
an unbounded `KeyError` out of a reducer contracted to *return findings*, and out of `__post_init__`,
which is documented and tested to raise `ValueError`. A caller catching `ValueError` would not catch
it. Measured pre/post: the pre-repair tree **accepted** that same input, so the repair converted a
fail-open into a fail-closed — an improvement — but with the wrong exception class and a docstring
that misstates the reason.

#### F80 — **P3** — `preparation.py:53` and `tests/test_observe.py:671`. **OPEN.**

`PRESENT_KEY` is imported into `preparation` and used nowhere in it (`grep` returns the import line
only). The new `HOST_READING_CONSUMERS` table declares `("preparation", "PRESENT_KEY")` under the
comment "Every module that reads one of those names" — false about the shipped tree. The `is`-identity
assertion therefore pins a **dead import** in place: removing it, the natural cleanup and an F401
`ruff` would flag, turns the test red for a reason unrelated to the collision hazard it exists to pin.

#### F81 — **P3** — `observe.py:76`. **OPEN. Widens F77 undisclosed.**

`observe.__all__` is pinned by `test_observe.py:604` to five names. Before this commit `preparation`
imported three names outside it and `runner` none; the commit takes `preparation` to **six** and
`runner` to **one**. A refactor trusting the pinned `__all__` may now rename or delete `PRESENT_KEY`,
`HOST_IMAGE_KEYS` or `local_presence_findings` with the surface contract and its test both green
while two modules break. F77 was already open; this commit widened it without saying so.

#### F82 — **P3** — `observe.py:324-326`. **OPEN.**

The new `image` inventory check early-returns ahead of the `unread` identity check, so a copy
carrying **both** an identity defect and an image-inventory defect now reports the image defect and
masks the identity one. Measured: pre-repair reported `granted_image_identity: unresolved — ['tag']
were never read`; post-repair reports the image inventory instead. No input changes from refused to
accepted — diagnostic text only.

#### Claims the reviewer VERIFIED TRUE — do not re-audit

- **The repair does close the hole it names, for ordinary mappings.** All seven hostile readings were
  REFUSED by `replace`: `present` False / dropped / `1` / `"yes"` / `None`, an extra unreviewed key,
  and an empty mapping. The positive control — an unchanged `MappingProxyType` copy — was ACCEPTED
  with `satisfied=True`, so the check is not vacuously refusing everything.
- **Nothing was weakened.** A 14-case pre/post differential shows **zero** refuse→accept transitions.
  Three moved accept→refuse. Two moved **RAISE→refuse** (`image` as `str`, `image=None`: pre-repair
  `AttributeError`, post-repair a bounded finding) — an undisclosed improvement.
- Both call sites really do run `keyed` first — `preparation.py:572` with an extra
  `isinstance(image, Mapping)` guard at `:570`, and `observe.py:324` — each with an early return. For
  plain mappings there is no `KeyError` path; the only reachable raise is F79's subclass case.
- **One object, no stale duplicates.** `preparation.PRESENT_KEY is observe.PRESENT_KEY`,
  `runner.PRESENT_KEY is observe.PRESENT_KEY`, `preparation.HOST_IMAGE_KEYS is
  observe.HOST_IMAGE_KEYS` all `True`. Only `observe` assigns. No import cycle; all ten modules
  import cleanly.
- The commit's 13-failed/452-passed intended-RED claim is **exact**, and the two extra added tests are
  positive controls that correctly pass in both states. Sizes as claimed, `observe.py` 676, all under
  800. Census 58 failed / 1486 passed, split **51** `test_scripts_inert.py` + **7**
  `test_surface_contract.py`, all carrying the identical absent-implementation reason.
- **The stated residual is accurate, and the docstring is more complete than the commit message.** A
  full field sweep found `docker_platform`, `docker_executable` and `probe_executable` equally
  unvalidated against an empty mapping, beyond the `selected_image_identity` the message names. The
  docstring's clause "and neither is any other field" covers them; the message gives one example.
  Refused: `control_identities`, `image`, `ephemeral_range`, `granted_image_identity`.

#### Hypotheses the reviewer REFUTED by measurement — do not re-raise

- *The new collision test is vacuous because `"present"` is interned.* The `is`-identity half is
  indeed vacuous for the string, but the test's **AST half is real**: reintroducing the declarations
  into `preparation.py` fails it with `the host reading keys are declared in ['observe',
  'preparation']`. The hazard is genuinely pinned.
- *The reorder lets some previously-refused input through.* No refuse→accept transition exists.
- *Moving the keys to `observe` closes an import cycle.* It does not.
- *`prepare()`'s live path is exposed to F78/F79.* It is not — `frozen()` normalises the subclass away.

#### Reviewer-stated limits

`ruff`/`mypy` not run (absent). The 58 REDs not investigated beyond count, file split and reason. No
runtime, Docker, PKI, network or entrypoint execution — none exists. `admission.py`, `adapter.py`,
`plan.py` not reviewed except for the package-wide grep. **F45/F46/F47/F65 not re-verified** by this
reviewer — they were the other lane's subject. Coverage not measured. `copy.copy` /
`object.__setattr__` excluded per brief as a known pre-existing hatch; F78 is deliberately *not* that
hatch.

### Standing at the close of this cycle

`47dce0e` is **measured, reviewed, and NO-GO**. It is not pushable. The open set is now **F78** (P1,
new) plus **F45, F46, F47, F65** (P1 as recorded; a re-grade to P2/P3 is proposed above and awaits a
second independent opinion). P1 ≠ 0 on any reading, so the atomic entrypoint GREEN stays blocked.

### Next action

Repair **F78** test-first — it is the newest P1, it defeats a control this range just added, and its
repair is small: read the presence answer through the same protocol the inventory check and the
binding comparison use, so one field is not judged through three accessors. The reviewer's
`Lying(dict)` construction is the RED. F46 and the second opinion on the re-grade follow it.

Nothing was pushed. PR #55 stays draft at `73ec822`. RUNTIME remains **HOLD** — no entrypoint script
exists and none was executed.

---

## Cycle 36 — F78 and F79 repaired test-first at `f2bb2c5`

### Live state reconciliation at cycle open

The supplied checkpoint named HEAD `76553f4`. That was stale by 46 commits. Live HEAD at cycle
open was `c4f8668`, the branch 59 ahead of `origin`. PR #55 remains **draft, OPEN, CLEAN** at
`73ec822` with all four rendered hosted checks SUCCESS (two `secret-scan`, two `contract standards
validation`). The untracked `integration/topology-rehearsal/uv.lock` was preserved untouched.

### Census re-measured at `c4f8668` before any edit

`58 failed / 1493 passed` was the *post*-repair figure; the pre-edit baseline measured at
`c4f8668` was **58 failed / 1486 passed**, which matches exactly the split the previous reviewer
recorded (51 `test_scripts_inert.py` + 7 `test_surface_contract.py`, all carrying the identical
absent-implementation reason). No unintended failure exists at HEAD.

### F78 — **REPAIRED**. `observe.py:278-330`, `tests/test_observe.py`, commit `f2bb2c5`

The reviewer's `Lying(dict)` construction was written as the RED first: a `dict` subclass
overriding `__getitem__` to answer `True` for the presence key while `.items()` and `.get()` store
`False`, wrapped in `MappingProxyType` and fed through `dataclasses.replace` on a genuine
`PreparationResult`.

The repair takes the answer from the reading's own iteration — the protocol `keyed` uses to
validate the inventory, that `preparation.frozen` uses to rebuild the mapping, and that
`runner._observed_identity` carries forward — instead of from `__getitem__`. A subscript that
disagrees with the stored entry is itself refused, so the field's two views cannot diverge.

### F79 — **REPAIRED** in the same commit. `observe.py:289`

The old docstring claimed `keyed` made `image[PRESENT_KEY]` readable. `keyed` (`grant.py:300-329`)
computes `tuple(value)` — it iterates keys and never touches a value, so the claim was false about
the shipped tree. The docstring is corrected, and a subscript that refuses to answer is now
converted into a finding rather than raising an unbounded `KeyError` out of a reducer contracted to
return findings and out of `__post_init__`, which is documented and tested to raise `ValueError`.

### Measured GREEN — coordinator's own measurement, not the writer's

| Gate | Result |
|---|---|
| focused `test_adapter/test_observe/test_preparation/test_runner` | **934 passed** |
| broad census | **58 failed / 1493 passed** — failure count unchanged from the 58 baseline |
| `compileall` over `src/` | clean |
| `observe.py` size | **709** lines, under the 800 bound (was 676) |

The seven added passes are the new tests; **no absent-script RED changed character and no new
failure appeared**. `ruff` and `mypy` remain absent and were not run.

### The P3 ledger defect at line 2096 — **DISCHARGED**

The prose sentence asserting "an aliased callee is caught by the module-name walk instead
(`aliased-helper`)" now carries an inline correction naming it false and pointing at the F47
measurement that refuted it. The same false claim in the `call_parameter_bindings` docstring was
already corrected in source.

### What this cycle did NOT do, stated so it is not read as wider than it is

- **No independent review of `f2bb2c5` was obtained.** The repair is measured but **unreviewed and
  unpushable**. Commissioning it is the next cycle's first action.
- The second independent opinion on the proposed F45/F46/F47/F65 re-grade was commissioned in
  parallel and had not returned when this cycle closed. **The re-grade therefore remains PROPOSED,
  not applied**, exactly as the previous cycle left it.
- No entrypoint script was written or executed. No Docker, listener, network or PKI path was
  touched. The atomic entrypoint GREEN was deliberately not attempted, because P1 ≠ 0.

### Open set at the close of this cycle

**F45, F46, F47, F65** — P1 as recorded, re-grade proposed and awaiting a second independent
opinion. **F80, F81, F82** — P3, open. F78 and F79 are repaired but their repair is unreviewed, so
neither is discharged until an independent verdict says so.

P1 ≠ 0 on any reading. The atomic entrypoint GREEN stays blocked and nothing is pushable.

### Next action

Obtain the independent review of `f2bb2c5`, and the still-owed second opinion on the re-grade. If
that second opinion confirms the downgrade and `f2bb2c5` clears, P1 reaches 0 for the first time in
this range and the atomic entrypoint GREEN becomes reachable. Otherwise repair **F46** test-first —
the widest of the three helper gaps.

Nothing was pushed. PR #55 stays draft at `73ec822`. RUNTIME remains **HOLD** — no entrypoint script
exists and none was executed.

### F83 — **P1** — `src/cybrik_suite_topology_rehearsal/observe.py:321-348`. **NEW, OPEN.**

Surfaced by the F78 writer while measuring its own residual, and recorded here rather than folded
silently into a commissioned repair. **F78 was repaired on the live reading only; the pinned
identity has the identical three-protocol hazard, and it is still open.**

`signed_identity_findings` reads the identity through `identity[key]` — `__getitem__` — at the
`unread` check, the registry-digest loop, `platform_findings` and the binding comparison, while
`keyed` validates that same mapping by *iteration*. A `MappingProxyType` over a `dict` subclass
therefore passes `__post_init__`'s exact-`type()` gate and every declared read-only-mapping gate
while its subscript disagrees with what it stores. Measured by the writer:

```
stored tag: FORGED | .get('tag'): FORGED | identity['tag']: '16-alpine'
replace(result, granted_image_identity=liar) -> ACCEPTED, satisfied = True | recorded tag = FORGED
```

A copy asserts `satisfied is True` while *recording* a forged tag. This is the exact mirror of F78
with the live reading and the pinned identity swapped, so it is the same authority defect on the
other operand and is graded the same: **P1**.

Scope note recorded so the repair is not mis-sized: `preparation.image_findings` reads the other
six reading keys and `observed_at` through `image[key]` as well, so the same seam exists a third
time in `preparation.py`. `prepare()`'s live path is expected to be immune for the same reason it
was immune to F78 — `frozen()` rebuilds any mapping from `.items()`, normalising a subclass away —
but that has **not** been re-measured for the identity operand and must not be assumed.

#### Correction to the F78 repair's description above

The repair does **not** simply stop calling `__getitem__`. It keeps the subscript as a *cross-check*:
acceptance requires the stored entry to be exactly `True` **and** the subscript to agree. The writer
measured that pure single-protocol reading would have produced a **refuse→accept** transition,
because `__getitem__` remains a live protocol on this field elsewhere (`runner._selected_identity`
reads `image[key]`), so trusting `items()` alone would have re-admitted F79's previously-refused
case. The stricter shipped form is deliberate.

#### The repair's differential, as measured by the writer against `c4f8668`

16 cases, **zero refuse→accept**. Exactly two rows moved, both toward refusal: the F78 liar
`ACCEPTED(satisfied=True)` → `REFUSED(ValueError)`, and the F79 refuser `RAISE(KeyError)` →
`REFUSED(ValueError)`. The remaining 14 are identical, including **two** positive controls — an
unchanged `MappingProxyType` copy and a no-override `dict`-subclass proxy — both still
`ACCEPTED(satisfied=True)`. The check is not vacuously refusing.

Intended RED was `5 failed, 2 passed, 114 deselected`; GREEN `7 passed, 114 deselected`. The two
that passed in both states are the deliberate positive controls.

### Open set correction

F83 joins the open P1 set: **F45, F46, F47, F65, F83**. P1 ≠ 0 stands independently of how the
proposed F45/F46/F47/F65 re-grade resolves, because F83 is new, un-regraded and a live authority
defect of the same shape the range has been closing. The atomic entrypoint GREEN remains blocked.

---

## Cycle 37 — the two owed independent opinions commissioned, and F83 repaired test-first

### Live state reconciliation at cycle open

The supplied checkpoint named HEAD `76553f4` and "11 commits ahead". Both were stale. Live HEAD at
cycle open was **`f787935afe56ed4e0b97dc9ed0b2f1072bdb79c3`**, the branch **62 ahead** of `origin`.
PR #55 remains **draft, OPEN, CLEAN** at `73ec822` with all four rendered hosted checks SUCCESS
(two `secret-scan`, two `contract standards validation`, both under the `contracts` workflow). The
untracked `integration/topology-rehearsal/uv.lock` was preserved untouched and is the only entry in
`git status --short`.

Commit provenance re-derived from `git show --stat`, not from prose: of the five commits after the
last reviewed point `47dce0e`, **exactly one carries source** — `f2bb2c5` (`observe.py` +49/-8,
`tests/test_observe.py` +126). `564a4e4`, `c4f8668`, `0f13ae7` and `f787935` are
`docs/REVIEW-LEDGER.md`-only. The unreviewed *source* surface of this range is therefore `f2bb2c5`
alone, and that is what was commissioned for review.

### Census measured at `f787935` on a pristine tree, before any agent was launched

```
58 failed, 1493 passed in 0.70s
```

Classified by file, not assumed: **51 in `tests/test_scripts_inert.py` + 7 in
`tests/test_surface_contract.py` = 58**. This is the identical split every prior cycle recorded.
`ls scripts` returns **no such file or directory**, which is the direct cause: all 58 are
absent-entrypoint-script REDs. **No unintended failure exists at HEAD.**

### Three lanes commissioned this cycle — status at the moment this checkpoint was written

Recorded before the results were in, so the record cannot later be read as claiming more than was
obtained:

1. **Independent review of `f2bb2c5`** (the F78/F79 repair, the range's only unreviewed source) —
   commissioned, read-only, pinned to `git show f787935:` reads so the concurrent writer could not
   move the tree beneath it. **Outstanding at checkpoint.**
2. **Second independent opinion on the proposed F45/F46/F47/F65 re-grade** — commissioned,
   read-only. This is the opinion the previous cycle owed and did not obtain, so the re-grade
   stays **PROPOSED, not applied**. **Outstanding at checkpoint.**
3. **F83 repair, test-first**, owning exactly `observe.py` and `tests/test_observe.py`, mirroring
   `f2bb2c5`'s shipped dual-protocol cross-check onto the pinned-identity operand, with mandatory
   positive controls and a zero-refuse→accept differential. **Outstanding at checkpoint; the working
   tree carried no source edit when this commit was made.**

### What this cycle did NOT do

No entrypoint script was written or executed. No Docker, listener, network, PKI or database path was
touched. Nothing was pushed. The atomic entrypoint GREEN was deliberately not attempted, because
P1 ≠ 0. `ruff` and `coverage` are both **absent** from this venv (`No module named ruff`,
`No module named coverage`); no dependency was installed to obtain them, so lint and coverage
evidence remain unavailable by authority, not by oversight.

### Open set at this checkpoint — unchanged from cycle 36's close

**F45, F46, F47, F65** — P1 as recorded, re-grade proposed and still awaiting the second opinion.
**F83** — P1, open, repair in flight. **F80, F81, F82** — P3, open. F78 and F79 are repaired but
their repair is unreviewed, so neither is discharged.

P1 ≠ 0 on every reading. Nothing in this range is pushable.
