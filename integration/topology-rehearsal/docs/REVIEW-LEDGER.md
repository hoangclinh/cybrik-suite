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

## Open non-technical items for the Founder

- `integration/topology-rehearsal/uv.lock` is untracked and un-ignored in
  this worktree, pending a dependency decision. See repo-root `CLAUDE.md`:
  dependency installation is Founder-gated.

## Ledger maintenance

Append new rows/sections above rather than editing prior ones, except to
fix factual errors. Do not relabel any past verdict as IMPLEMENTED,
VERIFIED, or GA — this ledger records review verdicts on code, not
runtime or production status.
