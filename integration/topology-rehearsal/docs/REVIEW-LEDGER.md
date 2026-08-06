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
| `b580b2c..eb472c1` | F29 RED, one commit (`test_scripts_inert.py` excluded) | GO on the RED | 0/1/1/2 | NO | HOLD |
| `5bef003` | F39 repair | NO-GO | 0/4/3/3 | NO | HOLD |
| `3e9bba6` | F30 repair | NO-GO | 0/2/1/2 | NO | HOLD |
| `42d6d02` | F60/F61 repair | NO-GO | 0/1/4/2 | NO | HOLD |
| `09da45d..0f6883f` | Cycle-26 range | GO | 0/0/3/2 | NO | HOLD |
| `0f6883f..47dce0e` | F75 repair | NO-GO | 0/1/1/3 | NO | HOLD |
| `4b25214` | F83 repair (`.get` protocol uncovered) | NO-GO | 0/3/1/1 † | NO | HOLD |
| `9b96f49` | `views.py` extraction, scoped to the extraction | GO | 0/0/1/2 † | NO | HOLD |

† The eight rows above `b580b2c..eb472c1` quote a reviewer-stated P0/P1/P2/P3 line. For the two
rows marked †, the reviewer's prose states only part of the count (`4b25214`: "NO-GO"; `9b96f49`:
"P0 = 0 and P1 = 0"), so the remaining figures are **derived by this ledger** from the findings each
verdict opened — F85/F86/F87 + F88 + F89 for `4b25214`, and F91 + F92/F93 for `9b96f49`. They are
reconstructions, not quotations, and are marked so they are never mistaken for the reviewer's own
arithmetic. See F95.

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

### The owed second opinion on the F45/F46/F47/F65 re-grade — **LANDED. PARTIAL.**

This is the opinion the previous two cycles owed and did not obtain. It is independent, it
**measured** rather than deferred, and it **partially rejects** the proposal it was asked to check.

**Verdict: all four confirmed OUT of P1. Landing grades: F45=P2, F46=P2, F47=P3, F65=P2.**

The one rejection: the proposing auditor put F45 at **P3**; this opinion puts it at **P2**, on the
ground that the P3 rested on the evading shape being exotic when its *host* limb is not — a default
is evaluated at import, `os.getcwd()`/`os.environ[...]` in a default is an ordinary idiom, and "a
module-level helper reading `os.environ` for a worktree path" is the exact evasion the guard's own
docstring at `tests/test_scripts_inert.py:1510` names as its reason to exist. The grant limb is
genuinely weak (an `authorization` is not in scope at import time), which is why it is P2 and not
higher. **The re-grade is therefore applied as corrected, not as proposed.**

#### What was measured, not read

Probes imported the *shipped* helper (not a copy) and ran against the shipped package.

`F45` — six shapes through `call_parameter_bindings`/`argument_pairs`
(`tests/test_scripts_inert.py:1343-1385`), which read `call.args` and `call.keywords` and never
`signature.defaults` or `kw_defaults`:

| shape | `root_sinks` | `module_wide_offences` | verdict |
|---|---|---|---|
| `def _wire(values=os.environ["CONTROL_ROOT"])` + `_wire()` | 3 | `[]` | **MISSED** |
| grant-origin default `values=_declared(AUTHORIZATION)` | 3 | `[]` | **MISSED** |
| kw-only default `*, values=_declared(...)` | 3 | `[]` | **MISSED** |
| root-shaped *parameter* name `roots=os.environ[...]` | 3 | `[]` | **MISSED** |
| root-shaped *helper* name `_suite_root(value=os.environ[...])` | 4 | 2 offences | CAUGHT |
| positive control — same value passed as an argument | 3 | `line 14: a control root derives from ['values']` | CAUGHT |

The `sinks>=2` floor holds in every row, so these are verdicts about the derivation walk, **not**
about vacuity. The last three rows are the reviewer's own additions and are what moved F45 up.

`F46` — `call_parameter_bindings:1349` skips any callee whose `node.func` is not an `ast.Name`,
although the `functions` table built by `ast.walk` at `:1343-1346` already holds every method's
signature under its bare name. `_Wiring().wire(...)` MISSED; `@staticmethod` via `_Wiring.wire(...)`
MISSED; but **natural class-shaped wiring with the grant read in a `roots()` method was CAUGHT**
(root-shaped method name, flagged by `root_sinks`' `held` branch). That row is the reviewer's own and
narrows the finding: the evasion needs a callee that is simultaneously attribute-spelled,
non-root-named **and** laundering through a parameter. A cross-module callee (`helpers.wire(...)`)
also MISSED, but that is the already-P3 F50 class and was correctly **not** counted against F46.

`F47` — `_alias = _wire` then `_alias(...)` → `offences=[]`, MISSED; the byte-identical control
calling `_wire` directly → CAUGHT. The alias is the sole cause, and the *uncompounded* alias is
still caught: all 11 pinned `EVADING_WIRING_SHAPES` including `aliased-helper` remain CAUGHT at
HEAD and `CONFORMING_WIRING_SHAPE` is still clean.

`F65` — run against a genuine `prepare(documents.authorization(), fakes.passing_adapters())`,
genuine pin `2026-08-05T00:00:00Z` → attempt `20260805T000000Z-c8`:

- single-field control → **REFUSED**, `ValueError: granted_observed_at '1970-01-01T00:00:00Z' is
  not the exact UTC instant '2026-08-05T00:00:00Z' the authorization signed…` — not vacuous;
- two-field epoch forgery → **ACCEPTED**, `satisfied=True`, `runner._attempt_names` returns
  `attempt_id='19700101T000000Z-c8'`, `container='cybrik-topology-19700101T000000Z-c8'`;
- three-field forgery moving `granted_image_identity` + `image` together → **ACCEPTED**,
  `satisfied=True`, `image.repository='attacker/exfil'`,
  `image_reference='attacker/exfil@sha256:eee…'`, at the cost of one retry to satisfy the
  registry-digest shape on `local_image_id`.

The finding reproduces in full and the ledger's broadened three-field scope is **accurate**.

#### Why "no live bypass" is a measured claim here, not an assumption

The reviewer tested for (b) — shipped code actually exhibiting the evading shape — and found (a) for
all four:

- `src/` contains **zero** reads of `environ`, `getcwd`, `cwd()` or `__file__`, so no host root
  source exists to place in a default;
- the guard's actual subject, `scripts/run_topology_rehearsal.py`, **does not exist** (the test
  fails for absence of subject), while the guard's own effectiveness test passes `2 passed`;
- `module_wide_offences` run over all ten shipped `src/` modules: the only two holding root sinks,
  `plan.py` and `runner.py`, produce **zero** derivation offences;
- `src/` has **one** `PreparationResult(` construction (`preparation.py:708`) and **zero**
  `dataclasses.replace` calls — the only `replace` tokens are `str.replace` (`runner.py:116`),
  `datetime.replace` (`grant.py:251`) and `os.replace` (`adapter.py:671`);
- decisively for F65, `run_topology_rehearsal` (`runner.py:742-743`) does
  `prepared = prepare(authorization, adapters)` against the module-level import and hands it
  straight to `_attempt_names` — the result **never crosses an injected seam**. Under this package's
  declared threat model, the hostile injected adapter (`tests/test_preparation.py:86-92`: "the
  attack is not a malformed document but a live alias"), the adapters never see the result.

The reviewer also accepted the consistency argument on its own terms: grading the same
copy-carries-no-authorization shape P2 under F75 and P1 under F65 was inconsistent.

#### Reviewer-stated limits — recorded so they are not silently dropped

`observe.py` and `test_observe.py` were read **pinned at `f787935`**, never from the working tree,
because a writer held them. The `src/`-wide sweep applied a wiring-scoped guard to library modules
it was never designed for: the `computed attribute name` offences it reports in `admission.py`,
`grant.py`, `preparation.py`, `protocols.py` and `runner.py` are `getattr(self, name)` validator
loops, **not defects**, and were correctly not treated as evidence either way. F48-F55, F66-F83 and
F1-F44 were **not** re-verified. For F65 only `granted_image_identity`, `granted_observed_at` and
`image` were attacked; the other `PreparationResult` fields were not swept and the
`object.__setattr__`/`copy.copy`/subclass bypasses (F71) were not retested. `ruff` and `mypy` remain
absent and were not run. Nothing was edited or committed by the reviewer.

#### The gating answer, stated exactly

**On these four alone, P1 would reach 0.** At HEAD it does **not**, because **F83** is open,
un-regraded, and a live authority defect. The reviewer formed no opinion on F83 — it was outside the
commission. The atomic entrypoint GREEN therefore stays blocked, and this re-grade does **not** open
the gate. It removes four of the five reasons it was shut.

### Open set after applying the corrected re-grade

**P1: F83 only** — open, repair commissioned this cycle, result not yet in.
**P2: F45, F46, F65.** **P3: F47, F80, F81, F82.**
F78 and F79 remain repaired-but-unreviewed and are not discharged.

P1 ≠ 0. Nothing is pushable.

---

## Cycle 38 — the F83 repair landed, measured and checkpointed at `4b25214`

The previous cycle timed out with the F83 repair uncommitted in the working tree. This cycle
measured it rather than trusting it, committed it as `4b25214`, and commissioned two independent
opinions on it. **Nothing was pushed. PR #55 stays draft at `73ec822`. RUNTIME remains HOLD — no
entrypoint script exists and none was executed.**

### The repair, stated exactly

`observe.stored_entries(mapping, label)` reads an inventory once by `.items()` and returns both what
the mapping *stores* and a finding for every entry whose subscript disagrees with it — including a
subscript that refuses to answer, which is reported as a finding rather than escaping the reducer.
`signed_identity_findings` now takes every binding from the stored view: the unresolved check, the
registry-digest loop, `platform_findings` and the binding comparison.

The subscript is **kept as a cross-check, not dropped**, for the same reason the F78 repair kept it:
`__getitem__` is a live protocol on this field elsewhere (`runner._selected_identity`, `grant`'s own
reductions), so trusting `items()` alone would re-admit the F79 case. Disagreement in either
direction is a refusal.

### Measured at this cycle's HEAD, not read

| gate | result |
|---|---|
| intended RED — the new cases against the pre-repair module at `361292d` | **11 failed, 15 passed, 112 deselected** |
| GREEN — `tests/test_observe.py` at `4b25214` | **138 passed** |
| broad static census — whole `tests/` tree at `4b25214` | **1510 passed, 58 failed** |
| every one of the 58 | in `test_scripts_inert.py` / `test_surface_contract.py` only — the known absent-entrypoint REDs; **zero new failures** |
| `compileall src tests` | exit 0 |
| `git diff --check 361292d..4b25214` | clean |
| `observe.py` against the pinned `MODULE_LINE_LIMIT = 800` (`tests/test_surface_contract.py:95`) | **762 lines — 38 lines of headroom** |

The 15 that pass in the RED state are the deliberate positive controls, including an unchanged
`MappingProxyType` copy and a no-override `dict`-subclass proxy. The control is therefore not
vacuously refusing: the RED is a real refuse→accept differential on the forged shapes alone.

The census is quoted from a clean tree at `4b25214` with only the untracked `uv.lock` present. It
is **not** runtime evidence: 58 REDs stand precisely because the two entrypoint scripts this slice
owes do not exist yet.

### `ruff` and `mypy` remain absent

Neither is installed and neither may be installed without a separate dependency decision, so lint
and typecheck are **not** discharged for this commit. Recorded rather than skipped silently.

### F84 — **P2** — `src/cybrik_suite_topology_rehearsal/observe.py:369`. **NEW, OPEN.**

Found by the coordinator's own probe of the repair it had just committed, before either
commissioned opinion returned, and recorded rather than held.

`stored_entries` refuses when `subscripted is not value` — **object identity**, not equality. A
mapping whose `__getitem__` returns an equal-but-distinct object is therefore refused although its
two views agree on the value, and the finding it emits contradicts itself. Measured against the
shipped module at `4b25214`:

```
distinct object? False | equal? True          # subscript returns a new str with the same value
honest reconstructing mapping -> REFUSED
  probe: tag reads as '16-alpine' by subscript while this mapping stores '16-alpine',
         so its two views of one entry disagree
```

The message names the same value twice and calls it a disagreement, which is unreadable as a
refusal reason.

**Why P2 and not P1.** This fails *closed*, not open: it refuses honest input rather than admitting
forged input, so it is not an authority bypass and cannot produce a `satisfied=True` copy recording
unsigned material. No shipped path currently triggers it — every identity mapping the live path
builds is a plain `dict` or is rebuilt by `preparation.frozen`, so its subscript returns the
identical object. It is a latent correctness defect on an injected seam plus a self-contradictory
diagnostic.

**The repair is not obvious and must not be rushed.** The apparent fix — compare with `==` — has a
real cost: a hostile value's `__eq__` can claim equality it does not have, which weakens the
cross-check that exists to protect the *other* `__getitem__` readers (`runner._selected_identity`,
`grant`'s reductions). It does not weaken this reducer, which judges only the stored view. The
candidate repair is therefore `subscripted is not value and subscripted != value` — identity as the
fast path, equality as the fallback — with the diagnostic reworded to distinguish "a different
value" from "a different object". **Deferred to the next cycle so the two commissioned opinions can
be taken into account**, since this is an authority-sensitive comparison.

The sibling at `observe.py:325` (`subscripted is not True`, the F78 repair) is **correct as
written** and is not affected: `True` is a singleton, and identity there is deliberate — it refuses
a truthy proxy that is not the boolean itself.

### Open set at this cycle's close

**P1: F83 — repaired at `4b25214`, measured, but its two independent opinions are commissioned and
not yet returned, so it is NOT discharged.**
**P2: F45, F46, F65, F84.** **P3: F47, F80, F81, F82.**
F78 and F79 remain repaired-but-unreviewed.

P1 is not provably 0. **Nothing is pushable.**

---

## Cycle 39 — F84 repaired and checkpointed; F83's independent verdict is NO-GO

Two lanes ran: an exact-path writer on the F84 repair, and two independent read-only reviewers on
the F83 repair (`361292d..4b25214`) with disjoint lenses. Reviewers read source pinned at `4daa0ea`
via `git show`, never the working tree, because the writer held `observe.py` and `test_observe.py`.
**Nothing was pushed. PR #55 stays draft at `73ec822`. RUNTIME remains HOLD — no entrypoint script
exists and none was executed.**

### Census reconfirmed at `4daa0ea` before any edit

**1510 passed, 58 failed.** All 58 are in `test_scripts_inert.py` (51) and
`test_surface_contract.py` (7) — the known absent-entrypoint REDs. Zero unintended failures.

### F84 — **REPAIRED** at `6c684df`. `observe.py:376-401`, `tests/test_observe.py`

Agreement between a mapping's two views is now the *value*, not the object. Identity stays the fast
path; the fallback demands `type(subscripted) is type(value)` and `(subscripted == value) is True`
and `(value == subscripted) is True`. A comparison that raises is a finding, not an escape.

Bare `==` was rejected as the fallback on purpose: `__eq__` is defined by the object being judged,
and the readers this cross-check is claimed to protect receive the subscripted object rather than
the stored one. Exact-type-first means a lookalike of another class is refused before its `__eq__`
runs; `is True` rather than truthiness refuses a truthy non-bool; both directions refuse an
asymmetric `__eq__`. `local_presence_findings`' `subscripted is not True` (`observe.py:325`) is
deliberately untouched — `bool` cannot be subclassed and `True` is a singleton.

| gate | result |
|---|---|
| intended RED — new cases against the pre-repair module pinned at `4daa0ea`, in a copy outside the repo | **3 failed, 142 passed** |
| GREEN — `tests/test_observe.py` | **145 passed** |
| broad static census | **1517 passed, 58 failed** (baseline 1510/58; +7 for the 7 cases added, **zero new failures**) |
| `compileall -q src tests` | exit 0 |
| `git diff --check` | clean |
| `observe.py` vs pinned `MODULE_LINE_LIMIT = 800` | **791 lines — 9 lines of headroom** |

The RED was re-measured by the coordinator independently of the writer, against the pre-repair
module, and reproduced 3F/142P. The four other new cases are positive controls that held before and
after — they are exactly what a naive `==` repair would have broken.

**Residual, stated rather than hidden.** Two objects of the *exact same type* that mutually claim
`True` are still accepted. **`observe.py` has 9 lines of headroom; the next edit to this module
likely needs an extraction first.** `ruff` and `mypy` remain absent, so lint and typecheck are not
discharged. This repair is itself **unreviewed**.

### F83's independent verdict: **NO-GO**. The `.get` protocol is uncovered.

The authority-lens reviewer reproduced GREEN (138 passed at `4daa0ea`) and reproduced ledger F84
exactly, then broke the repair. The finding that matters: **there are four views of these mappings —
`__iter__`, `.items()`, `__getitem__` and `.get` — and `stored_entries` reconciles only two.**
`.get` is the protocol actually used at `observe.py:430` for the live reading and at
`preparation.py:233` for the identity. The docstring claim at `observe.py:346-349` that "the two
views cannot diverge whichever one a later reader happens to use" is **false as written**.

### F85 — **P1** — `src/cybrik_suite_topology_rehearsal/observe.py:430`. **NEW, OPEN.**

The repair moved the identity operand of the binding comparison to the stored view but left the
*other* operand read through `image.get(key)`, which `stored_entries` cross-checks on neither
mapping. A live reading whose `.get` answers genuine while everything it stores and subscripts is
the attacker's yields **zero findings**.

Measured: with `class GetLies(dict)` delegating `.get` to the genuine image and
`MappingProxyType(GetLies({**genuine, "repository": "attacker/exfil", "tag": "EXFIL", ...}))`,
`keyed(image)` is `()`, `local_presence_findings` is `()`, `signed_identity_findings` is `()`,
`satisfied=True`, and `runner._attempt_names` returns
`image_reference='attacker/exfil@sha256:eeee…'`. One field, no epoch trick, no two-field replace.
This is an authority bypass that records unsigned material as proved.

### F86 — **P1** — `src/cybrik_suite_topology_rehearsal/preparation.py:233`. **NEW, OPEN.**

The same third-protocol hole against the *pin binding*. `granted_observed_at` is bound to the
identity two lines from the `stored_entries` call site, through `.get`. An identity that stores and
subscripts the genuine instant while its `.get` answers the epoch is accepted: `stored_entries`
returns no divergence, `signed_identity_findings` is `()`, `satisfied=True`, and
`runner.attempt_id_for` yields `'19700101T000000Z-c8'`.

Distinct from **F65**: F65 moves `observed_at` inside the identity too, so an auditor reading the
identity sees the epoch. Here the identity reads genuine through every view an auditor would use.

### F87 — **P1** — `observe.py:356` with `preparation.py:198`. **NEW, OPEN.** Validate-then-record TOCTOU.

`__post_init__` records the caller's object rather than a rebuild — `frozen()` is called only in
`prepare()` (`preparation.py:731`), never on the `dataclasses.replace` copy seam this pin exists
for. `stored = dict(mapping.items())` is therefore one read that binds nothing about later reads.

Measured: a `dict` subclass counting `items()` calls, honest for the first three reads and hostile
thereafter through `items()`, `__getitem__` and `.get` alike, is accepted with `satisfied=True`
after validation consumed only two reads; the recorded field then reports `repository='attacker/exfil'`
by iteration *and* by subscript, and `preparation.frozen(...)` hands that forgery to every
downstream consumer. **The docstring claim that "every recorded copy carries exactly what
`.items()` yielded" is false on the copy path.**

### F88 — **P2** — `observe.py:413,422,424,427,430`. **NEW, OPEN. A regression `4b25214` introduced.**

`keyed` validates the inventory by `__iter__` (`grant.py:315`, `tuple(value)`) while `stored` is
built from `.items()`. When those disagree, `signed[key]` raises an **uncaught `KeyError`** out of a
reducer contracted to return findings and out of a `__post_init__` documented — and tested by this
very commit — to raise `ValueError`.

Measured differential: pre-repair `361292d` returns `findings: ()`; post-repair `4b25214` raises
`KeyError('tag')`, and `dataclasses.replace(...)` raises `KeyError`, not `ValueError`. The commit's
own `test_a_proved_result_refuses_an_unreadable_signed_identity_as_a_value_error` asserts precisely
the property this new path breaks by another route.

### F89 — **P3** — `observe.py:346-349`. **NEW, OPEN.** The stated rationale is factually wrong.

The reason given for keeping the subscript cross-check *on this field* is that
`runner._selected_identity`/`_observed_identity` read it by subscript. They do not — they read
`prepared.image` (`runner.py:246,260`). `grep -rn "granted_image_identity" src/` returns only
`preparation.py:114,195,233,238`. **No module in `src/` reads `granted_image_identity` by
subscript at all.** This also weakens F84's "the repair is not obvious" argument, which rested on
the same non-existent reader.

### What the reviewer confirmed rather than broke

- "The subscript was kept as a cross-check, not dropped" — **TRUE** (`observe.py:365-373`).
- "Every binding is read from the stored view" — **TRUE only for the identity operand**.
- "No control was weakened to obtain GREEN" — **TRUE narrowly**; no assertion was removed and GREEN
  was reproduced. But **"nothing regressed" is FALSE** — see F88.
- Duplicate `.items()` pairs are **not** a bypass: `dict(...)` and `preparation.frozen` collapse
  identically, so no consumer sees the shadowed pair.
- `subscripted is not True` at `observe.py:325` is **sound** — `bool` cannot be subclassed.

### Not reviewed, stated so it is not mistaken for coverage

`admission.py`, `plan.py`, `protocols.py`, `errors.py`, `constants.py` and `adapter.py` beyond
greps. The claimed "11 failed / 15 passed" RED for `4b25214` was **not** independently re-derived —
only GREEN was reproduced. `selected_image_identity`, `control_identities`, `docker_platform`,
`docker_executable` and `probe_executable` were not attacked; `stored_entries` judges none of them.
`preparation.image_findings` and the whole live `prepare()` path were not attacked — every attack
lands on the `dataclasses.replace` copy seam. F45/F46/F47/F65/F78/F79/F80-F82 were not re-verified.
`ruff`/`mypy` absent and not run. Nothing was written, staged or committed by either reviewer.

**The second reviewer's correctness/false-refusal/test-quality opinion was commissioned in the same
cycle and had not returned when this was recorded. It is outstanding, not waived.**

### Open set at this cycle's close

**P1: F83 (repaired at `4b25214`, now independently NO-GO), F85, F86, F87.**
**P2: F45, F46, F65, F88.** **P3: F47, F80, F81, F82, F89.**
F78, F79 remain repaired-but-unreviewed. F84 is repaired at `6c684df` and unreviewed.

P1 = 4. **Nothing is pushable. The atomic entrypoint GREEN stays blocked.**

### The exact next repair

**F85/F86/F87 are one defect wearing three faces: validation reconciles a subset of a mapping's
protocols and then records an object it does not own.** Patching `.get` alone would leave F87
standing and invite a fifth protocol. The candidate direction is to make the recorded object a
rebuild the validator owns — apply `preparation.frozen` (or an equivalent snapshot) at the
`__post_init__` seam so that what is judged and what is recorded are the same object — and to judge
that snapshot rather than the caller's mapping. That is authority-sensitive and must be designed
before it is written. **`observe.py`'s 9 remaining lines mean the extraction comes first.**

## Cycle 40 — census reconfirmed at `5626339`; the F85/F86/F87 repair designed before it is written

### Measured census at the exact live HEAD

Measured by the coordinator on the live tree at `5626339cc1a5f04308b6d187c2d0948ff4f938b`, with
the untracked `uv.lock` preserved and nothing staged:

```
uv run --frozen python -m pytest tests -q
58 failed, 1517 passed in 0.71s
```

**Every one of the 58 is the intended absent-script RED, and none is a regression.** The failures
fall in exactly two files — 51 in `tests/test_scripts_inert.py` and 7 in
`tests/test_surface_contract.py` — and every one of them is raised by the shared fail-closed gate at
`tests/conftest.py:93`:

> `missing C8 implementation — this RED test states the final runner behaviour and fails closed
> until it exists: .../scripts/prepare_topology_grant.py does not exist`

`integration/topology-rehearsal/scripts/` does not exist on disk. The two entrypoints are still
unwritten, which is the state the spec intends until the P1 set is discharged. The count is
unchanged from `0a50a4a`'s classification, so no test began failing for a new reason across the
intervening 40-odd commits.

### The file-size control, measured rather than quoted

`tests/test_surface_contract.py:95` sets `MODULE_LINE_LIMIT = 800`. Live counts under
`src/cybrik_suite_topology_rehearsal/`:

| module | lines | headroom |
|---|---|---|
| `adapter.py` | 799 | 1 |
| `grant.py` | 794 | 6 |
| `observe.py` | 791 | 9 |
| `preparation.py` | 771 | 29 |
| `runner.py` | 756 | 44 |
| `admission.py` | 725 | 75 |

The ledger's standing claim that `observe.py` has 9 lines of headroom is **confirmed by
measurement**, not inherited. `adapter.py` at 799 has one line and remains the sharpest hazard.

### Open set carried into this cycle, unchanged

**P1: F83 (repaired at `4b25214`, independently NO-GO), F85, F86, F87.**
**P2: F45, F46, F65, F88.** **P3: F47, F80, F81, F82, F89.**
F78, F79 repaired-but-unreviewed. F84 repaired at `6c684df`, unreviewed.

P1 = 4, so nothing is pushable and the atomic entrypoint GREEN stays blocked. Origin/PR #55 remains
at `73ec822` with four SUCCESS hosted checks; the local branch is 69 commits ahead and none of that
range is push-eligible.

## Cycle 41 — the `observe.py` size blocker is cleared by a registered extraction at `c06a81b`

### What this cycle did and why

Cycle 40 designed the F85/F86/F87 repair and closed on an exact obstacle: *"`observe.py`'s 9
remaining lines mean the extraction comes first."* The repair needs room in a module that had 791
of its 800 permitted lines. This cycle performed only that extraction, so the repair itself can be
written and reviewed as a judgement rather than tangled with a move.

The four mapping-view reducers `observe` was authored around — `nested`, `IMMUTABLE_LEAVES`,
`immutability_findings` and `stored_entries` — now live in
`src/cybrik_suite_topology_rehearsal/views.py` (163 lines). Their bodies are unchanged. `observe`
re-imports all four, so every name a caller already reached for through `observe` still resolves
there, and `preparation` (`preparation.py:52,54`) keeps reading the same objects it always did.

`observe.py` falls **791 → 676 lines**, from 9 lines of headroom to 124. The pending repair has
room. `adapter.py` at 799 is untouched and remains the sharpest remaining size hazard.

### Measured, in three states, on the live tree with the untracked `uv.lock` preserved

```
committed HEAD 14f0784        58 failed, 1517 passed
extraction, unregistered      59 failed, 1516 passed
after registration (c06a81b)  58 failed, 1523 passed
```

The middle state matters more than the last one. The single new failure was
`test_the_module_inventory_is_exactly_the_reviewed_inventory` (`test_surface_contract.py:260`),
failing with `Left contains one more item: 'views'`. **The inventory control detected the new module
on its own and refused it.** That is the control working, and it is recorded here as a measured
effectiveness proof rather than as an inconvenience.

The response was to *register* `views` in the reviewed inventory, not to exempt it:
`C8_MODULES` (`tests/conftest.py:30`), the front door's present sentence
(`src/cybrik_suite_topology_rehearsal/__init__.py`) and `FRONT_DOOR_PRESENT_MODULES`
(`test_surface_contract.py:81`). Registration is what *subjects* the module to controls — it is now
covered by every parametrized per-module gate: import, docstring, the exact `LIBRARY_STATUS` line,
the unevidenced-status-claim ban, sorted non-repeating resolvable `__all__`, the
process/socket/network import ban, and the mutable-module-level-global ban. The six additional
passes are exactly those gates. A `views.py` left unregistered would have been an unreviewed file
inside the package, which is the state the inventory control exists to prevent.

All 58 remaining failures carry the shared fail-closed message from `tests/conftest.py:93`
(`missing C8 implementation — ... does not exist`); `grep -c` returns exactly 58, and no failure
has any other cause. `scripts/` still does not exist. **No test moved from pass to fail across this
cycle, and no control was weakened to obtain the result.**

### Static gates at `c06a81b`

`python -m compileall src tests` exits 0. `ruff` is **present in this environment and was run**,
correcting the standing ledger claim that it was absent. It reports 12 errors, of which **10 are
pre-existing** on this branch and untouched by this cycle (`observe.py` ISC004 ×5,
`preparation.py:53` F401 and ISC004 ×2, `test_errors.py:12` and `test_runner.py:3` I001) and **2 are
new**, recorded as F90 below. `mypy` is genuinely absent (`Failed to spawn: mypy`) and was not run;
no dependency was installed to obtain it. **No formatter or auto-fixer was run**, and `--fix` was
not used, per the standing prohibition.

### F90 — **P3** — `observe.py:84,85`. **NEW, OPEN.** A re-export seam ruff reads as dead code.

`ruff` reports `F401 .views.IMMUTABLE_LEAVES imported but unused` and the same for
`immutability_findings`. Measured: both names are genuinely uncalled inside `observe.py`, but the
import is **load-bearing** — `preparation.py:52,54` imports both `from .observe`, so deleting the
re-export breaks `preparation` at import time. Ruff is right about this module and wrong about the
package.

This is P3, not a defect of behaviour: it is a lint signal on a seam the extraction created. Note
the identical pre-existing case at `preparation.py:53` (`PRESENT_KEY` re-exported from `observe`),
so the pattern predates this cycle and ruff had simply never been run against it.

Two candidate repairs, neither taken here because both widen blast radius mid-review: point
`preparation` at `.views` directly and drop the two names from `observe`'s import (cleanest, and
object identity is preserved either way because `views` is the single declaration site); or keep
the re-export with an explicit `# noqa: F401` stating why. The first is preferred. **Deciding this
belongs with the F85/F86/F87 repair, which will touch both modules anyway.**

### What this cycle explicitly did NOT do

It did not begin the F85/F86/F87 repair, write either entrypoint script, run either entrypoint,
push, or touch `uv.lock`. It is an enabling refactor and its registration, nothing more. **The
extraction's independent review was commissioned in this cycle and its verdict is recorded below;
until that verdict is recorded, `c06a81b` is a recoverable checkpoint and not push-eligible.**

### F91 — **P2** — `docs/REVIEW-LEDGER.md`, findings F85, F87, F88, F89. **NEW, OPEN.** The extraction invalidated the open findings' own line anchors.

Surfaced by the independent reviewer of `c06a81b` and confirmed by measurement. Removing 115 lines
from the middle of `observe.py` shifted every line below them, so the `file:line` anchors this
ledger uses to locate the open P1/P2/P3 set now point at unrelated code:

| finding | recorded anchor | what is there now | true current site |
|---|---|---|---|
| F85 | `observe.py:430` | `"""Reduce the five independent publication views...` | `observe.py:341,344` (`signed[key] != image.get(key)`) |
| F87 | `observe.py:356` | `return None` | **`views.py:126`** (`stored = dict(mapping.items())`) |
| F88 | `observe.py:413,422,424,427,430` | `return None`, blank | `observe.py:327,334,336,338,341,344` (`signed[key]`) |
| F89 | `observe.py:346-349` | `return tuple(findings)` | **`views.py:108,119`** (the false `runner._selected_identity` rationale) |

Two of the four findings **no longer live in `observe.py` at all** — F87's TOCTOU seam and F89's
factually-wrong rationale both travelled into `views.py` with the code that carries them. F86's
anchor at `preparation.py:233` is unaffected, because `preparation.py` was not touched.

This is P2 rather than cosmetic. A repair driven from a stale anchor edits the wrong line, and a
later reviewer who checks an anchor, finds unrelated code and concludes the finding was discharged
would close a live P1 by accident. The three earlier cycles that "lost finding detail" are the
precedent this ledger already records for exactly that failure mode.

**This is a defect of the extraction cycle, not of the findings.** The extraction was reviewed for
behaviour and is behaviour-preserving; what it silently broke is the ledger's ability to point at
its own open set. Re-anchoring is owed before the F85/F86/F87 repair begins, since that repair is
driven directly off these anchors. The table above is the re-anchoring; it is recorded here rather
than by rewriting the original entries, so the audit trail of what was found where stays intact.

### Independent review of the extraction — status at this cycle's close

Commissioned in this cycle against the full extraction. **Measured and reported before the cycle
closed:**

- `python -m compileall src tests` exits 0.
- The **failure set at `c06a81b` is identical, test-id by test-id, to the `14f0784` baseline** —
  the reviewer diffed the two sorted `FAILED` lists and they match exactly. 58 failures, same 58
  tests. This is a stronger statement than the matching counts recorded above, and it is the
  reviewer's own independent derivation rather than a reproduction of the coordinator's.
- F91 above.

The coordinator separately proved the pure-move claim mechanically rather than by reading: parsing
both files and comparing `ast.dump` of each moved definition against its pre-extraction version
gives **IDENTICAL AST for all four** of `nested`, `IMMUTABLE_LEAVES`, `immutability_findings` and
`stored_entries`, with **none left defined in `observe.py`** (so no shadowed duplicate). Object
identity across the re-export seam is preserved and was verified at runtime:
`preparation.IMMUTABLE_LEAVES is views.IMMUTABLE_LEAVES`, same for `immutability_findings`, and
`observe.<name> is views.<name>` for all four. `views` has **zero package-internal imports**, so it
is a leaf and cannot introduce an import cycle.

**The reviewer's final GO/NO-GO verdict and its complete P0-P3 list had not returned when the cycle
closed. It is outstanding, not waived, and must be collected and recorded at the top of the next
cycle before anything else.** Nothing in this cycle is push-eligible.

### Open set at this cycle's close

**P1: F83 (repaired at `4b25214`, independently NO-GO), F85, F86, F87.**
**P2: F45, F46, F65, F88, F91.** **P3: F47, F80, F81, F82, F89, F90.**
F78, F79 repaired-but-unreviewed. F84 repaired at `6c684df`, unreviewed.

P1 = 4, unchanged. The atomic entrypoint GREEN stays blocked and nothing is pushable. Origin/PR #55
remains at `73ec822` with four SUCCESS hosted checks.

## Cycle 41 addendum — the extraction's independent verdict returned: **GO**

The verdict recorded above as outstanding returned before the cycle ended. It is **GO**, pinned to
the tree at `9b96f49`, with **P0 = 0 and P1 = 0**. The reviewer wrote, staged and committed nothing
and ran no `git checkout`/`reset`/`stash`; its only writes were to `/tmp`.

### What it derived independently, not by reproducing the coordinator

- All four moved bodies are **byte-identical** as source segments, not merely AST-equal — including
  both `# noqa: BLE001` comments, both `(KeyboardInterrupt, SystemExit)` re-raise pairs, the
  `seen: tuple[int, ...] = ()` default and every f-string. `IMMUTABLE_LEAVES` is a module-level
  tuple, not a closure, so nothing was captured or left behind.
- Baseline re-derived by exporting `14f0784` with `git archive` into a **clean tree**:
  `58 failed, 1517 passed`. At `c06a81b`: `58 failed, 1523 passed`. The failure **node-ID sets are
  identical, 58/58** — no failure introduced and, equally important, **none silenced**.
- The +6 passes are exactly the six `C8_MODULES`-parametrized gates, enumerated and each measured
  PASS for `views.py`.
- `observe.__all__` is unchanged and `tests/test_observe.py:606` asserts it as an **exact set**; it
  passes. No control anywhere in `tests/` asserts on `__module__`, `getsource`, `getsourcefile`,
  `dir()` or `inspect.` in a way this touches. The one dependency-direction control
  (`test_grant.py:682`) is `grant`-specific and untouched. `preparation → observe → views` is
  acyclic.

### A claim of ours the reviewer corrected, recorded because it was ours

Cycle 41 above argues that an unregistered `views.py` "would have been an unreviewed file inside the
package". That **overstates the gap**. `conftest.source_paths()` uses `rglob("*.py")` over `SRC`
rather than `C8_MODULES`, so four tree-wide controls — the 800-line size bound, the forbidden
address and installer literals, the tree-wide effect-import policy and the single-spawn-site
control — **already covered `views.py` before registration**. Nothing was ever outside a control's
reach. Registration added six per-module gates to a file that already had four; it did not rescue
the file from a hole. The honest version of the argument is the narrower one, and it still holds:
the inventory control refused the file unaided, and the response was to register rather than exempt.

Registration is additive in all three edits — no assertion deleted, relaxed or exempted — and it
makes `test_observe.py:676` scan one more module for `PRESENT_KEY`/`HOST_IMAGE_KEYS`, which is
**strictly stricter**. On the size question the reviewer argued both sides and concluded: the bound
is written as explicitly per-module, the bodies are byte-identical so no judgement was diluted, and
the net authored delta is +48 lines of imports and docstring. **Not control evasion.**

### F91 independently confirmed

The reviewer reached the stale-anchor finding on its own and its re-anchoring table agrees with the
one recorded above, including that F87 and F89 now live in `views.py` rather than `observe.py`. Its
framing is worth keeping: this "does not block the commit; it blocks safe consumption of the
commit," and following `observe.py:430` for F85 lands on unrelated code — "precisely the failure
mode that turned F83 into a NO-GO."

### F92 — **P3** — `views.py`. **NEW, OPEN.** The only C8 module with no exact `__all__` assertion and no test file.

Measured: every other module has an exact `__all__` set assertion — `test_constants.py:160`,
`test_errors.py:158`, `test_protocols.py:158,277`, `test_adapter.py:1790`, `test_plan.py:371`,
`test_grant.py:257`, `test_observe.py:606`, `test_preparation.py:415`, `test_admission.py:1293` and
`runner`. `views` has none, and there is **no `tests/test_views.py`**. It gets only the generic
sorted/non-repeating/resolvable check at `test_surface_contract.py:309`.

Failure scenario: a later edit adds a fifth name to `views.__all__`, widening the module's public
surface with no control objecting — the exact drift the per-module assertions exist to catch
everywhere else. All behavioural coverage of the four names currently reaches them *through*
`observe` or `preparation`; that coverage is real and passing, but it is coverage of the re-export,
not of the module.

### F93 — **P3** — `views.py:99-100,107-110,118-121`. **NEW, OPEN.** The new module is inaccurate at birth.

The `stored_entries` docstring names `local_presence_findings`, `preparation.frozen`,
`runner._selected_identity` and `grant`'s reductions. `local_presence_findings` used to sit directly
above it and is now in another file, so a reader of `views.py` in isolation cannot follow the
argument. More sharply, `views.py:108,119` **is the text F89 records as factually wrong** — `runner`
reads `prepared.image` (`runner.py:246,260`), not `granted_image_identity` by subscript. The pure
move faithfully carried a known-false rationale into a module being registered as reviewed for the
first time. Not a new defect, but it means F89's repair now has two sites.

### A CI fact worth recording on its own

The reviewer measured that `.github/workflows/contracts.yml` runs gitleaks and the JS contract
validators only: **no pytest and no ruff run against this package in CI at all.** The four SUCCESS
checks on PR #55 therefore say nothing whatsoever about this package's 1523 passing tests. That is
not a defect of this cycle, but it means every census in this ledger is local evidence only, and it
lowers the trigger probability for F90 (nothing in CI would run `ruff --fix`) while raising the
importance of the local gates.

### Open set after the verdict

**P1: F83 (repaired at `4b25214`, independently NO-GO), F85, F86, F87.**
**P2: F45, F46, F65, F88, F91.** **P3: F47, F80, F81, F82, F89, F90, F92, F93.**
F78, F79 repaired-but-unreviewed. F84 repaired at `6c684df`, unreviewed.

**The GO is scoped to the extraction, and only to it.** It does not discharge one pre-existing
finding. P1 = 4 and P2 = 5, so the push gate of P0 = P1 = P2 = 0 is not met, the atomic entrypoint
GREEN stays blocked, and none of the 73-commit local range is push-eligible. Origin/PR #55 remains
at `73ec822`.

**The exact next action is F91's re-anchoring**, because the F85/F86/F87 repair is driven directly
off anchors that are now wrong, and that repair must be designed against three files —
`observe.py:341,344` for F85, `views.py:126` for F87, `preparation.py:233` for F86.

## Cycle 42 — census remeasured at `deee9d2`; two evidence defects found in this ledger itself

### Live state reconciliation at cycle open

HEAD `deee9d2a4b8cd07fae6a9b4a1e31625d455dbbd8`, branch **74** commits ahead of `origin`. PR #55 is
OPEN, draft, `MERGEABLE`, still at `73ec822`, four rendered hosted checks SUCCESS (two
`secret-scan`, two `contract standards validation`). The untracked
`integration/topology-rehearsal/uv.lock` was preserved untouched and verified untracked before and
after every measurement. Nothing was pushed, staged outside the two docs commits, reset or stashed.

### Measured census at the exact live HEAD

Measured on the live tree at `deee9d2`, git state proved identical before and after:

```
uv run --frozen python -m pytest tests -q
58 failed, 1523 passed in 0.72s

uv run --frozen python -m pytest tests/test_adapter.py tests/test_observe.py \
  tests/test_preparation.py tests/test_grant.py tests/test_admission.py tests/test_plan.py -q
1137 passed in 0.46s

uv run --frozen python -m compileall -q src tests   # exit=0
```

**All 58 failures were individually confirmed intended**, not merely counted. Every one of the 58
tracebacks carries the same guard message — `missing C8 implementation — this RED test states the
final runner behaviour and fails closed until it exists: <path>/scripts/… does not exist` — and
`scripts/` is confirmed absent from the tree. They fall in exactly two files: 51 in
`tests/test_scripts_inert.py` and 7 in `tests/test_surface_contract.py`. **No failure has any other
cause.** The sorted node-ID list is reproducible by rerunning the command above.

This is the same 58/58 failure set as `14f0784` and `c06a81b`, now with +6 passes carried forward
from the extraction's per-module gates: 1517 → 1523.

### Module size — `adapter.py` has one line of headroom

```
799 adapter.py     794 grant.py      771 preparation.py   756 runner.py
725 admission.py   676 observe.py    533 plan.py          382 protocols.py
264 constants.py   163 views.py      159 errors.py         11 __init__.py
```

`MODULE_LINE_LIMIT = 800` (`tests/test_surface_contract.py:96`). **`adapter.py` is at 799 — one
line of headroom — and `grant.py` at 794 has six.** This is recorded here because it is a live
constraint on every future repair, not a defect: the F85/F86/F87 repair touches `observe.py` (124
free), `preparation.py` (**29 free**) and `views.py` (637 free), so `preparation.py`'s 29 lines are
the binding constraint on that repair, and any growth in `adapter.py` or `grant.py` now requires an
extraction first, exactly as `observe.py` did at cycle 41.

### F94 — **P3** — `observe.py:265,271,280,285,330`, `preparation.py:628,662`. **NEW, OPEN.**

`ruff 0.16.0` reports **12 errors**, not the three this ledger has recorded. Three are the F401
re-export seams already held as F90 and F15's precedent (`observe.py:84,85`, `preparation.py:53`);
two are the long-standing `I001` import-order pair (`test_errors.py:12`, `test_runner.py:3`,
recorded since cycle 3). **The remaining seven — `ISC004 Unparenthesized implicit string
concatenation in collection` — appear nowhere in this ledger.** They were never recorded because
`ruff` had not been run against `src` in the cycles that authored them.

Why this is a finding and not styling: every one of the seven sites is a **single-element tuple of
one finding message**, built by implicit concatenation inside the parentheses of a `return`:

```python
return (
    f"{label}: present is stated by no entry of this reading, so the reviewed "
    "material is not already on this host",
)
```

Ruff's own diagnostic on each is *"Did you forget a comma?"*. In a reducer contracted to return a
tuple of findings, **the number of elements is semantically meaningful**: a comma accidentally typed
between the two fragments silently turns one finding into two truncated ones, and a comma
accidentally omitted between two intended findings silently welds them into one. No control in
`tests/` asserts on the arity of these particular returns, so either slip lands GREEN. The current
text at all seven sites is correct — this is a latent authoring hazard on an authority-message seam,
which is why it is P3 and not P2.

Not repaired here, for the same reason F90 was not: the fix is parenthesisation across two modules
and belongs with the F85/F86/F87 repair that already opens both files. `ruff --fix` was **not** run;
running formatters or auto-fixers is Founder-gated by repo-root `CLAUDE.md`. `mypy` is still absent
and was not installed.

### F95 — **P2** — `docs/REVIEW-LEDGER.md:21-31`. **NEW. REPAIRED in this cycle.**

**This ledger stopped obeying its own documented protocol.** Lines 12-17 instruct: *"before pushing
any change in this component, the independent reviewer appends a new row/section below recording the
commit range, verdict, P0/P1/P2/P3 counts, PUSH-ELIGIBLE decision, and any open findings — in that
order."* The `## Verdict history` table held **8 rows, the newest `817227b..a1a97f6`**, while the
cycle sections below it record **8 further independent verdicts** that were never given a row:

`b580b2c..eb472c1`, `5bef003`, `3e9bba6`, `42d6d02`, `09da45d..0f6883f`, `0f6883f..47dce0e`,
`4b25214` and `9b96f49`. **The summary table therefore covered barely half the review history**, and
the half it omitted is the more recent half — including the two verdicts that most constrain the
present state: the `4b25214` NO-GO that opened the live P1 set, and the `9b96f49` GO.

Failure scenario, and it is the same one this file already warns about at line 16: a reader who
consults the summary table to answer "what is the current verdict state?" — the exact purpose the
table exists for — reads `817227b..a1a97f6` as the latest verdict and misses F83's NO-GO entirely.
The findings were never lost, but the index into them was, which is the same class of defect as F91
one level up: the evidence survives while the pointer to it rots.

**Repaired in this cycle** by appending all eight missing rows with their ranges, verdicts and
counts recovered from the prose sections. Two rows are marked `†` because the reviewer's prose
states only part of the count; those figures are reconstructions by this ledger and are labelled as
such rather than presented as the reviewer's arithmetic. No existing row was altered.

**This does not change the open set.** Every one of the eight verdicts was already recorded in full
in its cycle section; only the index was incomplete. P1 remains 4.

## Cycle 43 — F85 repaired test-first at `fa47e91`; the size-bound headroom claim corrected

### Live state reconciliation at cycle open

HEAD `9ff3e0d2010e70b2acfa3d4261e61bd41ce586bc`, branch **75** commits ahead of `origin`. PR #55 is
OPEN, draft, `CLEAN`, still at `73ec822`, four rendered hosted checks SUCCESS (two `secret-scan`,
two `contract standards validation`). The untracked `integration/topology-rehearsal/uv.lock` was
verified untracked and byte-identical (`sha256 24135c76f28231b2d5201028e741cc5da85a6b8af13feaf99e6668bac6ab25eb`)
before and after every measurement. Nothing was pushed, reset or stashed. `uv` was never invoked;
the pre-existing `.venv/bin/python3` (3.12.13, pytest 9.1.1) was used so the lockfile could not move.

The checkpoint this cycle opened from named HEAD `76553f4` and an 11-commit range. That is **64
commits stale**; live state was taken as authoritative and is recorded here so the drift is not
repeated.

### Census reconfirmed at `9ff3e0d` before any edit, and independently classified

```
python -m pytest tests -q -p no:cacheprovider     58 failed, 1523 passed in 0.75s
focused six-file set                              1137 passed in 0.47s
python -m compileall -q src tests                 exit=0
ruff check src tests                              12 errors
```

**All 58 failures were individually classified, not counted.** 51 in `tests/test_scripts_inert.py`,
7 in `tests/test_surface_contract.py`. Every traceback line carries `missing C8 implementation`;
`grep -E "^/.*\.py:[0-9]+:" | grep -v "missing C8 implementation"` returned **empty**, and `scripts/`
is confirmed absent from the worktree. **No unintended RED exists.** `tests/test_views.py` still does
not exist (F92 remains open on exactly that).

### F85 — **REPAIRED** at `fa47e91`. `observe.py:336-338,353-361`, `tests/test_observe.py`

The re-anchored finding (`observe.py:341,344`) was confirmed real against live source. `signed`
came from `stored_entries(identity, label)` and was correctly read from storage, but the *live
reading* operand was read through `image.get(key)` — a **third accessor nothing cross-checks**.
`keyed` validates by iterating, `local_presence_findings` reads what the reading stores, and
`stored_entries` reconciles `.items()` against `__getitem__` only. Confirmed empirically:
`mappingproxy.get` delegates to the underlying mapping's own `get`, while `dict.items` and
`dict.__getitem__` are resolved in C and do not — so a `dict` subclass overriding `get` alone
stored and subscripted a forged binding while answering this one comparison as the genuine one.

Repair: the live reading is snapshotted by `stored_entries(image, READING_LABEL)` exactly as the
identity is, a reading whose own two views diverge is refused *before* any binding is compared, and
the comparison reads the local plain-`dict` snapshot. **No injected protocol remains on either
operand.**

`live.get(key)` rather than `live[key]` is deliberate and pinned by its own test. `live` is the
local dict `stored_entries` built; it cannot be overloaded. Subscripting it would be a **new raise
path**: `keyed` validates by `tuple(value)` (iteration), a different protocol from
`dict(mapping.items())`, so a subclass overriding `items` alone passes `keyed` with a short snapshot
and `live[key]` would throw `KeyError` out of a reducer contracted to return findings — and out of
`preparation.__post_init__`, which is documented and tested to refuse with `ValueError`. With
`.get`, an absent key reads `None`, which the preceding `unread` guard proves can never equal
`signed[key]`, so it fails closed as a finding. This mirrors `local_presence_findings`'s existing
`if PRESENT_KEY not in stored` shape.

**Measured RED, then GREEN, not asserted:**

```
RED   9 failed, 2 passed, 145 deselected in 0.11s   — every failure `assert ()`, the bypass itself
GREEN 11 passed, 145 deselected in 0.02s
```

The two RED-phase passes were the premise test (the hostile construction clears the type gate,
`keyed`, `local_presence_findings` and `stored_entries` with zero divergence) and the positive
control. 12 tests were added in total; **no existing test was modified.**

**Measured after the repair, at `fa47e91`, reproduced independently by the coordinator:**

```
python -m pytest tests -q                58 failed, 1535 passed in 0.75s
focused six-file set                     1149 passed in 0.44s
python -m compileall -q src tests        exit=0
ruff check src tests                     12 errors — unmoved from baseline
wc -l observe.py                         693   (was 676; +17, limit 800)
```

Failures unchanged at 58 and still exclusively the absent-`scripts/` REDs; the pass count rose by
exactly the 12 added tests, 1523 → 1535. **No control was weakened.** `keyed(image, …)` and
`local_presence_findings(image, …)` are both still called in the same order; the new block only
*adds* a refusal path. Two existing tests that already relied on such readings being refused still
pass, now refused one step earlier. The new generator expression is explicitly parenthesised and is
**not** a new `ISC004`; the 12 ruff errors are the same 12 sites at shifted line numbers.

Two docstrings were repaired in the same commit because the change made them false:
`local_presence_findings` claimed "the binding comparison below reads through `.get`", and
`signed_identity_findings` gained the paragraph recording the closed hole and its mechanism.

**F85 is REPAIRED-BUT-UNREVIEWED.** It is not discharged. An independent verdict is owed before it
may count against the push gate.

### F96 — **P3** — `docs/REVIEW-LEDGER.md`, cycle 42's size table. **NEW. REPAIRED in this cycle.**

Cycle 42 recorded *"`adapter.py` is at 799 — one line of headroom — and `grant.py` at 794 has six."*
**Both figures are off by one, in the unsafe direction.** The live control is

```python
if len(module_source(path).splitlines()) >= MODULE_LINE_LIMIT      # tests/test_surface_contract.py:247
MODULE_LINE_LIMIT = 800                                            # :96, commented "Strictly under, not up to."
```

`>=`, so **799 is the maximum permitted count, not the last safe one below the ceiling**.
`adapter.py` at 799 therefore has **zero** headroom and `grant.py` at 794 has **five**.

Failure scenario, and it is not hypothetical: a future repair reads "one line of headroom", adds one
line to `adapter.py`, and trips `test_no_authored_module_exceeds_the_reviewed_size_bound` — turning a
bounded repair into an unplanned extraction mid-cycle, exactly the obstacle that cost cycle 40 its
whole repair and forced the `views.py` extraction at cycle 41. Corrected headroom, measured at
`fa47e91`:

| module | lines | free |
|---|---|---|
| `adapter.py` | 799 | **0** |
| `grant.py` | 794 | 5 |
| `preparation.py` | 771 | 28 |
| `runner.py` | 756 | 43 |
| `admission.py` | 725 | 74 |
| `observe.py` | 693 | 106 |

**Any edit to `adapter.py` now requires an extraction first.** This is P3 because it is an evidence
defect in this ledger rather than a defect in shipped source; it is recorded rather than silently
fixed because the wrong figure was already relied on once when planning the F85/F86/F87 repair.

### What this cycle did NOT do, stated so it is not read as wider than it is

It did not repair F86 or F87 — the directive is one exact finding per cycle, and both remain open at
their re-anchored locations (`preparation.py:233`, `views.py:126`). It did not write either
entrypoint script, run either entrypoint, touch `scripts/`, run Docker, install or update any
dependency, run any formatter or auto-fixer, or push. **RUNTIME remains HOLD.**

### Open set at this cycle's close

**P1: F83 (repaired at `4b25214`, independently NO-GO), F86, F87.** F85 repaired at `fa47e91`,
**unreviewed**.
**P2: F45, F46, F65, F88, F91.** **P3: F47, F80, F81, F82, F89, F90, F92, F93, F94.**

P1 = 3 and P2 = 5, so the push gate of P0 = P1 = P2 = 0 is **not** met, the atomic entrypoint GREEN
stays blocked, and none of the 76-commit local range is push-eligible. Origin/PR #55 remains at
`73ec822`.

### The exact next action

An independent Opus review of `fa47e91` (the F85 repair), then the **F86** repair at
`preparation.py:233` — the same third-protocol hole against the pin binding, where
`granted_observed_at` is bound through `.get` two lines from the `stored_entries` call site. F86's
repair must fit **28 free lines** in `preparation.py`, and note that `preparation.py:242,244` read
`self.image.get(OBSERVED_AT_KEY)` — the mirror of the hole just closed in `observe.py` — so that
site belongs in the same repair.

## Cycle 43 — the range's gates re-measured at live HEAD `671c8e6`, and F97 opened on this ledger's own irreproducible focused figure

### Why this section exists

The supplied checkpoint described the local range as `73ec822..76553f4`, eleven commits. **That is
stale by sixty-six commits.** Live `git status --short --branch` reports the branch **77 ahead** of
`origin/codex/uat-browser-g-u2b-db-red-gate-r1`, and live HEAD is `671c8e6`. Every figure below was
re-measured by the coordinator on the live tree at that HEAD, not copied from any prior section.

### Measured at `671c8e6`, on a tree carrying no modification

```
git status --short                      only ?? integration/topology-rehearsal/uv.lock  (preserved, untouched)
python -m pytest tests -q                58 failed, 1535 passed in 0.72s
python -m compileall -q src tests        exit=0
ruff check src tests                     12 errors
```

`ruff` is **not** installed in `.venv` — `python -m ruff` reports `No module named ruff`. The count
above was obtained from the system binary at `/opt/homebrew/bin/ruff`, which is the only ruff on this
host. Prior sections quoting "12 errors" did not record which ruff produced them; they are consistent
with this one.

**All 58 failures are the intended absent-`scripts/` REDs, proved by enumeration rather than
assumed.** `ls scripts` reports no such directory, and every failure lands in exactly the two files
that address it:

| file | failed | passed |
|---|---|---|
| `tests/test_scripts_inert.py` | **51** | 2 |
| `tests/test_surface_contract.py` | **7** | 80 |
| every other test file | **0** | 1453 |

No other test file contributes a single failure. The census total reconciles exactly:
1593 collected = 1535 passed + 58 failed.

### Per-file counts at `671c8e6`, recorded so no future section has to guess a set

| file | passed |
|---|---|
| `test_adapter.py` | 366 |
| `test_preparation.py` | 351 |
| `test_observe.py` | 157 |
| `test_admission.py` | 141 |
| `test_grant.py` | 108 |
| `test_protocols.py` | 102 |
| `test_runner.py` | 96 |
| `test_surface_contract.py` | 80 (7 failed) |
| `test_constants.py` | 77 |
| `test_errors.py` | 29 |
| `test_plan.py` | 26 |
| `test_scripts_inert.py` | 2 (51 failed) |

### Size table reconfirmed at `671c8e6` — the F96 correction holds

The control is `tests/test_surface_contract.py:247`, `>= MODULE_LINE_LIMIT` with
`MODULE_LINE_LIMIT = 800`, so **799 is the maximum permitted count and carries zero headroom.**
Live `wc -l`:

| module | lines | free |
|---|---|---|
| `adapter.py` | 799 | **0** |
| `grant.py` | 794 | 5 |
| `preparation.py` | 771 | 28 |
| `runner.py` | 756 | 43 |
| `admission.py` | 725 | 74 |
| `observe.py` | 693 | 106 |
| `plan.py` | 533 | 267 |
| `protocols.py` | 382 | 418 |
| `constants.py` | 264 | 536 |
| `views.py` | 163 | 637 |
| `errors.py` | 159 | 641 |

Unmoved from the F96 table. **`adapter.py` still requires an extraction before any edit.**

### F97 — **P3** — `docs/REVIEW-LEDGER.md`, every "focused six-file set" figure. **NEW, OPEN.**

This ledger records a *"focused six-file set"* count at least twice — **1137** at the `c06a81b`
extraction and **1149** at the `fa47e91` F85 repair — and **never names the six files.** An unnamed
set is not reproducible evidence, and this one is actively misleading: the obvious reading of
"focused" from the checkpoint's own wording is
`adapter/runner/admission/preparation/plan/observe`, and that set measures **1137 at live HEAD** —
numerically identical to the ledger's *pre-repair* figure, which invites the false conclusion that
the F85 repair added nothing.

Resolved by measurement rather than assumption. The set the ledger actually used substitutes
`test_grant.py` for `test_runner.py`:

```
adapter + admission + grant + plan + preparation + observe   1149 passed in 0.43s   (the ledger's set)
adapter + runner    + admission + plan + preparation + observe   1137 passed in 0.45s   (the collision)
```

Both figures the ledger quotes are **arithmetically correct for its own set**; 1137 → 1149 is exactly
the twelve tests `fa47e91` added to `test_observe.py` (62 → 68 test definitions, 145 → 157 collected).
**No prior claim is withdrawn.** The defect is that the set was never written down, and a coincidental
collision with a differently-composed set of the same size made the discrepancy look like a
regression until it was chased down. P3: an evidence-reproducibility defect in this ledger, not a
defect in shipped source.

Every future section quoting a focused figure must name its files. The set of record is
**`test_adapter.py`, `test_admission.py`, `test_grant.py`, `test_plan.py`, `test_preparation.py`,
`test_observe.py`**.

### F86's site re-read against live source before its repair is designed

`preparation.py:233` reads `self.granted_image_identity.get(OBSERVED_AT_KEY)` and compares it to
`self.granted_observed_at` at `:234`, **five lines before** `signed_identity_findings` is called at
`:238`. The mirror sites are `:242` and `:244`, both `self.image.get(OBSERVED_AT_KEY)`. The anchor is
**live and exact** — it has not drifted through the `c06a81b` extraction or the `fa47e91` repair.

### What this cycle did NOT do

It did not repair F86 or F87, write either entrypoint script, run either entrypoint, touch
`scripts/`, run Docker, install or update any dependency, run any formatter or auto-fixer, or push.
The untracked `integration/topology-rehearsal/uv.lock` was neither added, regenerated nor deleted.
**RUNTIME remains HOLD. PRODUCTION remains Founder-only.**

### Open set at this cycle's close

**P1: F83 (repaired at `4b25214`, independently NO-GO), F86, F87.** F85 repaired at `fa47e91`,
**still unreviewed and therefore still not discharged**.
**P2: F45, F46, F65, F88, F91.** **P3: F47, F80, F81, F82, F89, F90, F92, F93, F94, F96, F97.**

P1 = 3 and P2 = 5. The push gate of P0 = P1 = P2 = 0 is **not** met, the atomic entrypoint GREEN
stays blocked, and none of the 77-commit local range is push-eligible. Origin/PR #55 remains at
`73ec822`, draft, CLEAN, four rendered hosted checks SUCCESS.

> **CORRECTED IMMEDIATELY BELOW.** The open set as written in this section is wrong in three ways —
> it lists two findings this ledger repaired in-cycle, it silently drops three others, and it
> inherits an index that has tracked only a *subset* of open findings since line 3348. It is left
> standing verbatim so the correction has a subject. See *Cycle 43 (addendum)*.

## Cycle 43 (addendum) — the open-set index has been tracking a subset for eleven cycles

An independent read-only cross-check traced **every** finding ID in this file to its highest-line
mention and compared that against the `**P1: … P2: … P3: …**` recap lines. The recap is not a view of
the ledger. It is a separate, hand-maintained list that has drifted from the evidence beneath it.

### F98 — **P2** — `docs/REVIEW-LEDGER.md`, every open-set recap from `:3348` to `:4276`. **NEW, OPEN.**

**Three distinct defects, all confirmed against this file's own text.**

**(a) The recap has listed only F45-and-later since `:3348`.** Every recap line in the file is:

```
:3348  P2: F45, F46, F65.                 P3: F47, F80, F81, F82.
:3444  P2: F45, F46, F65, F84.            P3: F47, F80, F81, F82.
:3589  P2: F45, F46, F65, F88.            P3: F47, F80, F81, F82, F89.
 …
:4139  P2: F45, F46, F65, F88, F91.       P3: F47, F80, F81, F82, F89, F90, F92, F93, F94.
```

**No recap since `:3348` names a single finding below F45.** But this ledger's own register attests
at `:1633` *"There are no gaps in F1..F35"* and at `:1850` *"There are no gaps in F1..F44"*, and the
last recorded status of many of those is **OPEN**. The flagship case is **F16**, which at `:1858` was
**escalated from P3 to P2** and recorded *"CONFIRMED, counts re-measured … `adapter.py` has zero
lines of headroom"* — the exact constraint cycle 42 rediscovered from scratch as F96 and this cycle
reconfirmed. **F16 was never discharged and appears in no recap for eleven cycles.** F24, F25, F26
(*"measurably worse"*), F31, F32, F37 (*"surface WEAKENED, not repaired"*), F49, F51, F52, F53, F62,
F68 and F74 are likewise last recorded OPEN at P2 and absent from every recap; F6, F8-F11, F13, F29-A
are the same at P2 below F16. This is stated as a **pointer defect, not a re-grading**: none of those
findings is re-verified here, and some may be genuinely stale or superseded. That is precisely the
problem — **the ledger cannot currently tell which**, and the recap asserts a P2 count of 5 that its
own body does not support.

**(b) Cycle 42 silently dropped F78, F79 and F84.** Every recap from `:3445` through `:3885` carried
an explicit trailing sentence — *"F78, F79 repaired-but-unreviewed. F84 repaired at `6c684df`,
unreviewed."* — at `:3445`, `:3590`, `:3650`, `:3795` and `:3885`. At `:4137` **that sentence is
simply gone**, with no discharge, no review, and no statement anywhere between `:3885` and `:4152`
that resolves them. Three repaired-but-unreviewed findings left the ledger by omission.

**(c) Cycle 43 reproduced the drop and added two false entries.** The recap at `:4276` inherited the
F78/F79/F84 omission unchanged, and additionally listed **F96 and F97 as open P3** when both are
recorded in their own sections as **repaired in the cycle that opened them** — F96 at `:4096-4126`
(the corrected headroom table, published in the same commit) and F97 in this cycle (the six-file set,
named in the same commit). Neither is open. That error is the author's own and is corrected here
rather than silently overwritten.

This is P2 and not P3 because the recap is the artifact the push gate is read from. `P0 = P1 = P2 = 0`
is evaluated against a list that is **demonstrably not the set of open findings**, so the gate is
currently unevaluable in either direction — it cannot be trusted to block, and it cannot be trusted
to pass.

### F99 — **P3** — `docs/REVIEW-LEDGER.md`, finding IDs F56-F59. **NEW, OPEN.**

The F39-repair review numbered its findings *"from F45"* (`:2252`) and ran F45-F55. The next review
is numbered *"from F60"* (`:2257`). **F56, F57, F58 and F59 were never assigned to anything**, and no
line explains the skip. The ledger attests explicitly that there are no gaps in `F1..F35` (`:1633`)
and `F1..F44` (`:1850`); **no equivalent attestation was ever made for the F45+ range**, and this is
the gap it would have caught. Recorded rather than renumbered: renumbering would invalidate every
existing cross-reference.

### Corrected anchors — two findings drifted, both verified against live source

| finding | recorded anchor | what is actually at that anchor now | corrected anchor |
|---|---|---|---|
| **F65** (P2) | `preparation.py:260-263` | `guarded()`'s `except Exception` seam-refusal block — unrelated code | **`preparation.py:233-234`** |
| **F88** (P2) | `observe.py:327,334,336,338,341,344` (re-anchored once by F91) | the `keyed`/`stored_entries` guard prologue, not the subscripts | **`observe.py:342,349,351,353,357,361`** |

Both verified by reading live source, not inferred. F88 had already been re-anchored once by F91 —
but that re-anchor was made *before* `fa47e91`, which inserted the live-reading snapshot and shifted
every subscript below it. **A re-anchor is only true until the next commit that moves the code; F91's
correction was itself invalidated within one cycle.** The live `signed[key]` sites are exactly:

```
342:    unread = tuple(key for key in OBSERVED_IDENTITY_KEYS if signed[key] is None)
349:        f"{label}: {key} {signed[key]!r} is not a registry digest"
351:        if not registry_digest(signed[key])
353:    findings.extend(platform_findings(signed["platform"], label))
357:            f"{label}: {key} {signed[key]!r} is not the {key} {live.get(key)!r} the live"
361:        if signed[key] != live.get(key)
```

`:353` is a **sixth site F91's re-anchor never listed at all** — `signed["platform"]`, a literal-key
subscript on the same snapshot, subject to the same `keyed`-iterates-vs-`.items()`-builds divergence
F88 describes.

### The consequence for the F86 repair, which changes its design

**F65's corrected anchor `preparation.py:233-234` is the same site as F86.** They are not neighbouring
defects; they are two readings of one pair of lines:

```python
233:  signed = self.granted_image_identity.get(OBSERVED_AT_KEY)
234:  if type(self.granted_observed_at) is not str or self.granted_observed_at != signed:
```

F86 is the third-protocol hole in the `.get` at `:233`. F65 is the accepted three-field forgery that
moves `granted_image_identity` and `image` together through this same comparison. **A repair that
closes `:233` against F86 without accounting for F65 will have rewritten F65's site while leaving
F65 open** — and the next cycle will find F65's freshly-corrected anchor already stale again.

The F86 repair must therefore be designed against **F86 + F65 + the `:242,:244` mirrors together**,
inside `preparation.py`'s **28 free lines**. If that does not fit, the extraction must be planned
*first*, as a separate reviewed commit — the mistake cycle 40 made was discovering the size wall
mid-repair and losing the whole cycle to it.

### Corrected open set at cycle 43's close

**P1 (3): F83** (repaired at `4b25214`, independently NO-GO), **F86, F87.**
**Repaired-but-unreviewed (4), none discharged: F78, F79, F84, F85.**
**P2 (8, named): F45, F46, F65, F88, F91, F98, plus F16 and F37 restored from the body.**
**P3 (11): F47, F80, F81, F82, F89, F90, F92, F93, F94, F99, and F71.**
**Not counted, repaired in-cycle: F95, F96, F97.**
**UNRESOLVED COUNT:** the pre-F45 findings named in F98(a) are last recorded OPEN and are **not**
included in the counts above pending individual re-verification. **The true P2 count is at least 8
and is not currently known.**

P1 = 3 and P2 >= 8. The push gate is **not** met — and per F98 it is **not currently evaluable**.
None of the local range is push-eligible. Origin/PR #55 remains at `73ec822`, draft, CLEAN.

### The exact next action, revised

Before any further repair: **discharge F98** by re-verifying each pre-F45 finding last recorded OPEN
against live source and publishing one complete register, in the shape of the `:1581` register that
this ledger already knows how to write. Repairing F86 while the gate is unevaluable spends a cycle on
a finding that cannot be counted. F98 is cheap — it is read-only verification against a body of
evidence that already exists in this file — and it restores the only instrument the push gate has.

## Cycle 44 — F98's discharge begun: the pre-F45 and post-F77 bands re-verified against live source

### What this cycle did, and what it deliberately did not do

F98 (`:4293`) recorded that the open-set recap has not been a view of this ledger's body since
`:3348`, and made the push gate unevaluable in either direction. Its stated discharge (`:4408`) is to
re-verify **every** finding against live source and publish one complete register. This cycle
commissioned four **disjoint, read-only** independent verifiers, one per band — F1..F21, F22..F44,
F45..F77, F78..F99 — each required to re-read the live file and line before ruling, and to return
`UNVERIFIABLE` rather than infer. **Two bands (F1..F21 and F78..F99) returned within this cycle and
are published below. The F22..F44 and F45..F77 bands were commissioned and had not returned when the
cycle closed; they are OWED and F98 therefore remains OPEN, partially discharged.**

No repair was attempted this cycle. No source file was edited. `scripts/` was not created and neither
entrypoint was run. RUNTIME remains **HOLD**; PRODUCTION remains **Founder-only**.

### Gates re-measured by the coordinator at live HEAD `9439bd0`, on a tree carrying no modification

```
git status --short                      only ?? integration/topology-rehearsal/uv.lock  (preserved, untouched)
git status --short --branch             79 ahead of origin/codex/uat-browser-g-u2b-db-red-gate-r1
python3 -m pytest -q                    58 failed, 1535 passed in 0.77s
python3 -m compileall -q src tests       exit=0
ruff check --no-fix src tests           12 errors   (/opt/homebrew/bin/ruff 0.16.0; .venv/bin/ruff still absent — F15 stands)
```

Every figure is identical to cycle 43's at `671c8e6`. The five commits since then changed no gate.

**All 58 failures are absent-`scripts/` REDs, proved by enumeration, not assumed.** `ls scripts`
reports no such directory. Grouping every `FAILED` line by test function yields 33 distinct
functions, **51 in `tests/test_scripts_inert.py` and 7 in `tests/test_surface_contract.py`**, and no
failure in any other file. The largest single group is
`test_a_roots_argument_that_does_not_name_four_control_roots_is_refused` at 13 parametrisations.

**A focused set named exactly, so this figure is reproducible — the defect F97 recorded.** The command
`python3 -m pytest -q tests/test_adapter.py tests/test_runner.py tests/test_admission.py
tests/test_preparation.py tests/test_plan.py` reports **980 passed**. The complementary set
`tests/test_observe.py tests/test_surface_contract.py tests/test_scripts_inert.py` reports **58
failed, 239 passed**.

**The 12 ruff errors were independently reproduced and are exactly the set F90/F94/F15 already hold —
no new lint finding.** But F94's `observe.py` anchors are stale: it records the `ISC004` sites as
`observe.py:265,271,280,285,330`, and live ruff reports **`observe.py:266,272,281,286,345`**. The
first four are off by one — the recorded lines are the `return (` openers, the diagnostic lands on the
f-string beneath — and the fifth is wrong outright: live `:330` is
`refusals = keyed(identity, OBSERVED_IDENTITY_KEYS, label, ordered=False)`, an unrelated statement.
`preparation.py:628,662` are exact. This is the fourth independent confirmation that **a re-anchor is
only true until the next commit that moves the code**, which is F91's substance.

### Size bound re-measured — F16 confirmed, and the `:1858` measurement corrected

`tests/test_surface_contract.py:96` sets `MODULE_LINE_LIMIT = 800` and `:247` tests `>=`, so 799 is
the last legal length.

| module | lines | free |
|---|---|---|
| `adapter.py` | **799** | **0** |
| `grant.py` | 794 | 5 |
| `preparation.py` | 771 | 28 |
| `runner.py` | 756 | 43 |
| `admission.py` | 725 | 74 |
| `observe.py` | 693 | 106 |

**F16 stands at P2 with zero headroom in `adapter.py`.** The re-measurement recorded at `:1858` and
echoed at `:1690` — *"`adapter.py` 799, `preparation.py` **798**, `grant.py` 794"* — is **stale**:
`preparation.py` is 771, not 798, and has 28 free lines, agreeing with F96's corrected table at
`:4118`. Only the `adapter.py` 799 figure survives from that measurement.

### Band 1 of 4 — F1..F21 re-verified against live source. **8 CLOSED, 13 OPEN, 0 unverifiable.**

| ID | Sev | Subject | Live-source verdict | Evidence |
|---|---|---|---|---|
| F1 | P1 | Single-shared-executor control deleted from default path | **CLOSED** | `tests/test_scripts_inert.py:2077-2097` — AST walk asserts exactly one `SubprocessCommandRunner` call node |
| F2 | P1 | Argv-shape refusal band had zero tests | **CLOSED** | `tests/test_scripts_inert.py:270,317,372,438` — all four owed bands exist; `:301`/`:355` assert `calls == []` |
| F3 | P1 | Anti-self-witnessing guard bans the only buildable read | **CLOSED** | `tests/test_scripts_inert.py:1498-1520` — guard is the whole-module walk F3 prescribed |
| F4 | P1 | Spec's normative contract states a refuted shape | **CLOSED** | `ENTRYPOINT-SLICE-SPEC.md:59-114` — argv-boundary shape, `repository_roots` keyword-only mandatory |
| F5 | P1 | Attempt identity fixed from grant pin | **CLOSED** | `runner.py:331` — `attempt_id_for(prepared.granted_observed_at)`; no `OBSERVED_AT_KEY` read in the naming path |
| F6 | P2 | Behavioural half of the mandatory-roots test cannot fail | **OPEN** | `tests/test_scripts_inert.py:611-617` — `pytest.raises(TypeError)` then `assert loaded == []`, guaranteed by CPython binding |
| F8 | P2 | Publication walk cannot see private names | **OPEN** | `tests/test_scripts_inert.py:907` — `not name.startswith("_")`; `_executor._runner` still invisible |
| F9 | P2 | `wiring.command_runner` publishes the raw executor | **OPEN** | `tests/test_scripts_inert.py:995` — `assert wiring.command_runner is command_runner`; spec `:106` mandates it |
| F10 | P2 | Surface bound pins `__all__`, not the public namespace | **OPEN** | `tests/test_scripts_inert.py:684` — bound rests on unenforced privacy per its own comment `:667-676` |
| F11 | P2 | Mixin sited by line count, not cohesion | **OPEN** | `observe.py:682-684` — *"this is the one place the accessor can be added"* |
| F13 | P2 | No negative case pins refusal when `--execute` is absent | **OPEN** | `tests/test_scripts_inert.py:210` asserts `args.execute is True` positively only; `:565` never gates |
| F16 | **P2** | `adapter.py` at 799 against a strict `< 800` bound | **OPEN** | `adapter.py` = 799 vs `test_surface_contract.py:96,:247` — zero headroom |
| F7 | P2 | Owed-path item 4 incomplete; false "nothing weakens" claim | **CLOSED** | `ENTRYPOINT-SLICE-SPEC.md:531-559` — the false claim is explicitly withdrawn at `:553` |
| F12 | P2 | Obstacle 1 describes the withdrawn `.runner` accessor as required | **CLOSED** | `ENTRYPOINT-SLICE-SPEC.md:116,121-122` — `.runner` half recorded *"refuted and gone"* |
| F14 | P3 | One operator mistake, three refusal spellings | **OPEN** | `tests/test_scripts_inert.py:611,1107` (`TypeError`) vs `:397,1192` (`PrecheckAbort`) |
| F15 | P3 | `.venv/bin/ruff` absent; the pinned lint gate never ran | **OPEN** | `.venv/bin/` holds only `pytest, python, python3, python3.12` |
| F17 | P3 | Spec claims an argparse-required `--control-root` | **CLOSED** | `ENTRYPOINT-SLICE-SPEC.md:383-386` — pinned as a returned `HOLD_EXIT`, *"deliberately not as `required=True`"* |
| F18 | P3 | Spec names a test that does not exist | **OPEN** | `ENTRYPOINT-SLICE-SPEC.md:167` names `test_runtime_wiring_injects_the_one_executor_into_every_command_adapter`; zero hits under `tests/` |
| F19 | P3 | Spec says "amend six", lists five | **OPEN** | `ENTRYPOINT-SLICE-SPEC.md:418-419` lists `:154, :171, :201, :265` and a comment at `:285` — five |
| F20 | P3 | Spec calls the mixin uncommitted while supplying `.runner` | **OPEN** | `ENTRYPOINT-SLICE-SPEC.md:239-240` — both halves still false |
| F21 | P3 | Adjudication section's line numbers no longer resolve | **OPEN** | `ENTRYPOINT-SLICE-SPEC.md:372-440` — `:272`, `:247` blank; `:265` is `return 0`; `:285` a docstring; none is what the spec claims |

**The verifier attached a caveat that must not be dropped: F1, F2 and F3 are closed as *authored*
controls whose assertions live in `tests/test_scripts_inert.py`, which supplies 51 of the 58
absent-script REDs. Those three controls have never executed. Only F5 is closed against source that
runs today.** This is exactly why a green static census is not runtime-UAT proof.

### Band 4 of 4 — F78..F99 re-verified. **0 CLOSED, 7 REPAIRED-UNREVIEWED, 15 OPEN.**

| ID | Sev | Subject | Live-source verdict | Evidence |
|---|---|---|---|---|
| F78 | P1 | Presence read through a third protocol | REPAIRED-UNREVIEWED | `observe.py:263` builds `stored` from `.items()`; `:276-288` cross-checks the subscript. No verdict on `f2bb2c5` exists (`:3099`) |
| F79 | P2 | Unbounded `KeyError` out of the findings reducer | REPAIRED-UNREVIEWED | `observe.py:275-283` converts a refusing subscript into a finding |
| F80 | P3 | Dead `PRESENT_KEY` import pinned by a test | **OPEN** | `preparation.py:53` is the sole occurrence; `tests/test_observe.py:671-673` still pins it |
| F81 | P3 | Pinned `__all__` hides six cross-module imports | **OPEN** | `observe.py:90-96` names five; `preparation.py:50-57` imports six outside it |
| F82 | P3 | Image-inventory check masks the identity defect | **OPEN** | `observe.py:333-335` returns before the `unread` identity check at `:342` |
| F83 | **P1** | Pinned identity's three-protocol hazard (`.get`) | **OPEN — defect stands** | `observe.py:336` reconciles `.items()`/`__getitem__` only; `.get` is live at `preparation.py:233`; the NO-GO was never superseded |
| F84 | P2 | Object-identity refusal of honest rebuilt values | REPAIRED-UNREVIEWED | `views.py:139-156`; no verdict on `6c684df` anywhere |
| F85 | P1 | Live reading's operand read via `.get` | REPAIRED-UNREVIEWED | `observe.py:339` snapshots with `stored_entries`; `:357,:361` now read a plain `dict` |
| F86 | **P1** | Pin binding bound through an unreconciled `.get` | **OPEN — defect stands** | `preparation.py:233`, five lines before `signed_identity_findings` at `:238`, which never reconciles `.get` |
| F87 | **P1** | Validate-then-record TOCTOU on the copy seam | **OPEN — defect stands** | `views.py:126` `stored = dict(mapping.items())` is one read; `preparation.py:198-246` records the caller's object and never calls `frozen()` — `frozen` appears only in `prepare()` at `:710-731` |
| F88 | **P2** | `signed[key]` raises on iterate-vs-`.items()` divergence | **OPEN — anchors confirmed exact** | `keyed` iterates (`grant.py:315`) while `stored` is built from `.items()` (`views.py:126`); the six live sites are exactly `observe.py:342,349,351,353,357,361` |
| F89 | P3 | Subscript cross-check rationale names no real reader | **OPEN (narrowed)** | No `granted_image_identity` subscript reader in `src/`; but `runner.py:254` subscripts `image`, which `observe.py:339` made a `stored_entries` subject |
| F90 | P3 | Re-export seam ruff reads as dead code | **OPEN — anchors exact** | `observe.py:84,85` uncalled locally, load-bearing for `preparation.py:52,54` |
| F91 | **P2** | The extraction invalidated the ledger's own anchors | **OPEN** | Its own F88 re-anchor at `:3748` is wrong at live HEAD; no commit records F91 repaired |
| F92 | P3 | `views.py` has no exact-`__all__` test file | **OPEN** | No `tests/test_views.py`; only the generic check at `test_surface_contract.py:309-315` |
| F93 | P3 | The new module is inaccurate at birth | **OPEN** | `views.py:98` names `local_presence_findings`, now in another file; `:100`'s claim is falsified by F87 |
| F94 | P3 | Unparenthesized implicit concatenation in finding tuples | **OPEN — observe anchors stale** | live sites `observe.py:266,272,281,286,345`; `preparation.py:628,662` exact |
| F95 | P2 | Verdict-history table indexed only half the reviews | REPAIRED-UNREVIEWED | `:23-38` now carries 16 rows |
| F96 | P3 | Size-headroom figures off by one | REPAIRED-UNREVIEWED | corrected table at `:4113-4122` is right |
| F97 | P3 | The "focused six-file set" figure named no files | REPAIRED-UNREVIEWED | `:4253-4255` names the set; this cycle also names one and measures it (980 passed) |
| F98 | **P2** | The open-set recap is not a view of the body | **OPEN** | Its own discharge is only half-performed by this cycle |
| F99 | P3 | Finding IDs F56-F59 were never assigned | **OPEN** | `grep` returns only F99's own two lines — the gap is real |

### Six ledger self-contradictions the two bands found, each quoted from both sides

1. **F3 has two irreconcilable verdicts, both still standing.** `:865` — *"F3 is NOT discharged."*
   `:1763` — *"F3 — AMBIGUOUS → CLOSED."* The later line is chronologically authoritative and live
   source supports it, but `:865` was never withdrawn in place.
2. **F16's severity is stated two ways and never reconciled.** `:1611` — *"| F16 | P3 | … | OPEN |"*
   versus `:1858` — *"| F16 | P2 | CONFIRMED …"*. `:4396` restored F16 at P2 without noting that the
   `:1594` register still reads P3. **This cycle rules F16 P2.**
3. **F11's anchor is wrong in the ledger and in the spec, differently.** `:1243` says
   `observe.py:510-542`; spec `:132` says `observe.py:510-543`; live
   `class CommandAdapterAccessors` is at **`observe.py:661`**. Neither recorded anchor resolves.
4. **F88 carries two mutually exclusive anchor sets.** `:3748` lists
   `observe.py:327,334,336,338,341,344`; `:4352` lists `observe.py:342,349,351,353,357,361`. Live
   source resolves for `:4352`; `:3748` is stale and unmarked.
5. **F96/F97 are simultaneously recorded repaired and open.** `:4096` — *"REPAIRED in this cycle"* —
   versus the recap at `:4276`, which lists both as open P3. F98(c) diagnoses this and correctly
   leaves `:4276` standing as its subject.
6. **F81's `__all__` pin anchor is wrong.** F81 cites `tests/test_observe.py:604`; F92 at `:3850`
   cites `:606`; live `:606` is the assertion. F81's anchor is off by two.

### Corrected anchors published in one place, all verified against live source

| finding | recorded anchor | corrected anchor |
|---|---|---|
| F1 | `test_scripts_inert.py:1027-1042` | `tests/test_scripts_inert.py:2056-2100` |
| F3 | `test_scripts_inert.py:998-1016` | `tests/test_scripts_inert.py:1498-1560` (module-wide); `:1945` (function-scoped) |
| F5 | `runner.py:299-300` | `runner.py:286-307` (`attempt_id_for`), `:331` (sole naming call) |
| F6 | `:356-362` | `tests/test_scripts_inert.py:611-617` |
| F8 | `:709-753`, `:636-653` | `tests/test_scripts_inert.py:940-961`, `:891-907` |
| F9 | `:565, 603, 740, 1042` | `tests/test_scripts_inert.py:821, 858, 995` |
| F10 | `:414-421` | `tests/test_scripts_inert.py:667-684` |
| F11 | `observe.py:510-542` | `observe.py:661-693`; rationale at `:682-684` |
| F13 | `:292` | `tests/test_scripts_inert.py:210`, `:565` |
| F14 | `:356, 852, 939` | `tests/test_scripts_inert.py:611, 1107, 397` |
| F16 | `test_surface_contract.py:95, 246` | `tests/test_surface_contract.py:96`, `:247` |
| F18 | spec `:162` | `ENTRYPOINT-SLICE-SPEC.md:167` |
| F19 | spec `:413-414` | `ENTRYPOINT-SLICE-SPEC.md:418-419` |
| F20 | spec `:213-214` | `ENTRYPOINT-SLICE-SPEC.md:239-240` |
| F21 | spec `:377-435` | `ENTRYPOINT-SLICE-SPEC.md:372-440` |
| F4/F7/F12/F17 | ledger `:676-679` | spec `:59-114`, `:531-559`, `:116-138`, `:383-386` |
| F78 | `observe.py:278-330` | `observe.py:263-289` |
| F79 | `observe.py:289` | `observe.py:275-283`; docstring `:258-261` |
| F81 | `observe.py:76`; `test_observe.py:604` | `observe.py:90-96`; `tests/test_observe.py:606` |
| F82 | `observe.py:324-326` | `observe.py:333-335` against `:342` |
| F84 | `observe.py:369`, `:376-401` | `views.py:139-156` |
| F85 | `observe.py:430`, `:341,344` | `observe.py:339, 357, 361` |
| F87 | `observe.py:356` | `views.py:126` with `preparation.py:198-246` |
| F89 | `views.py:108,119` | `views.py:107-110, 118-121` |
| F93 | `views.py:99-100` | `views.py:98-100` |
| F94 | `observe.py:265,271,280,285,330` | `observe.py:266,272,281,286,345` |
| F86, F88, F90, F80 | as recorded | **confirmed exact**, no change |

### Open set at this cycle's close — partial, and honestly labelled as partial

**Verified this cycle (bands F1..F21 and F78..F99):**

- **P1 open (3): F83, F86, F87.**
- **P1 repaired-but-unreviewed, not discharged (2): F78, F85.**
- **P2 open (9): F6, F8, F9, F10, F11, F13, F16, F88, F91, F98** — ten IDs; F16 is the escalation the
  recap dropped for eleven cycles, and F6/F8/F9/F10/F11/F13 are the pre-F45 P2s F98(a) predicted
  would still be live. **Every one of them is confirmed still live by direct reading.**
- **P2 repaired-but-unreviewed (3): F79, F84, F95.**
- **P3 open (10): F14, F15, F18, F19, F20, F21, F80, F81, F82, F89, F90, F92, F93, F94, F99** —
  fifteen IDs.
- **CLOSED (8): F1, F2, F3, F4, F5, F7, F12, F17** — with the standing caveat that F1/F2/F3 close
  authored controls that have never executed.

**NOT YET VERIFIED — F22..F44 (including F29-A/B/C) and F45..F77.** The `:1581` register last
recorded F22-F35 with F22/F23/F29 repaired-unreviewed and F24, F25, F26 (*"OPEN, WIDENED"*), F27,
F28, F30, F31, F32, F34, F35 open, and F33 *NARROWED/PARTIAL*; F37 is recorded *"surface WEAKENED,
not repaired"* and F45, F46, F49, F51, F52, F53, F62, F65, F68, F74 last recorded open at P2. **None
of those is re-verified here and none may be counted or discharged until it is.**

**The push gate is NOT met and remains NOT fully evaluable.** P1 >= 3 with three P1 defects confirmed
standing in live source, and P2 >= 10. `P0 = P1 = P2 = 0` is far out of reach, so the atomic
entrypoint GREEN stays blocked and none of the 79-commit local range is push-eligible. Origin/PR #55
remains at `73ec822`, draft, CLEAN, four rendered hosted checks SUCCESS.

### The exact next action

Complete F98's discharge by re-verifying the two owed bands **F22..F44** and **F45..F77** against
live source, on the same read-only method and into the same register shape. Only then is the true
P2 count known and the gate evaluable. **Do not begin the F86 repair before that**, and when it
begins it must be designed against **F86 + F83 + F87 + F65 together** — F83's uncovered `.get`
protocol and F86's `.get` hole are the same call at `preparation.py:233`, F87's TOCTOU is the
recording seam five lines below it, and F65's accepted three-field forgery moves through the same
comparison. `preparation.py` has **28 free lines**; if the four do not fit, the extraction must be
planned first as its own reviewed commit.

## Cycle 44 (addendum) — the two owed bands returned. **F98 is fully discharged; the gate is evaluable for the first time since `:3348`.**

> **The section above is superseded on one point only.** It records bands F22..F44 and F45..F77 as
> commissioned-and-owed, because they had not returned when it was written. **Both returned within the
> same cycle.** Their results are published here. Every other figure, table and corrected anchor in
> that section stands as measured. It is left standing rather than rewritten, because the correction
> is the evidence that this ledger now records what it measured at the time it measured it.

### Band 2 of 4 — F22..F44 including F29-A/B/C. **9 CLOSED, 17 OPEN.**

**CLOSED (9):** F22 (`test_scripts_inert.py:1487-1490` folds `computed_attribute_reads` over the whole
module), F23 (`:1450-1460` — splatted and dict-keyed both sinks), F29 (`runner.py:331` +
`attempt_id_for` pure at `:286-307`), **F30** (`preparation.py:196` has no default and `:233-235`
requires both `type(...) is str` and agreement — F61's shape-only gap is gone live), **F32**
(`tests/test_preparation.py:382` now returns all eleven fields and `:774-783` pins the inventory),
F36 (REFUTED — the revert it claimed leaves the suite green in fact raises `NameError`), F39
(`:1299-1385` + fixed point `:1401`), F43 (`:1597` routes through the exported seam), F44
(spec `:147-151` names `runner.attempt_id_for`, not the private `_attempt_names`).

**OPEN P1 (1):** **F33** — OPEN-DEFERRED. The seam exists and is exported (`runner.py:81`), with one
renderer at `:307` and one caller at `:331`. The *second* caller cannot exist until `scripts/` does.

**OPEN P2 (8):** F24 (`test_scripts_inert.py:1283-1296` has no `ast.Expr` branch; `:1492` never
intersects `attribute_reads`), F25 (`:1213` still omits `getenv`; function-scoped set at `:2012`
likewise), **F26** (`:1561-1562` floor is still `len(root_sinks(module)) >= 2` over all four shapes —
the file's own docstring at `:1550-1551` concedes it), F29-A (`tests/test_runner.py:904-905` and
`:1198` state unshipped wiring in the present tense), F31 (the three collapsed statements persist at
`preparation.py:217, :510, :538/:550`), **F37** (`observe.py:661` `class CommandAdapterAccessors` is
absent from `__all__` at `:90-96`, and `test_surface_contract.py:312-315` never asserts that every
public name is listed — *no test names the class at all*), F40 (`:1450-1452` makes every
`keyword.arg is None` a sink regardless of contents), F41 (`:1444-1467` has no positional-argument
branch).

**OPEN P3 (8):** F27, F28, F29-B (**now worse** — since the F5/F29 repair the paired test at
`tests/test_runner.py:1042-1064` also asserts PASS, so nothing anywhere proves `PlanBoundDocker`
refuses any name), F29-C, F34, F35, F38 (`observe.py:5-6` claims every function is pure while
`:691-693` answers from `self._executor`), F42.

### Band 3 of 4 — F45..F77. **9 CLOSED, 2 SUPERSEDED, 4 UNASSIGNED, 18 OPEN.**

This band's verifier did not stop at reading: it **probed the shipped guard with constructed inputs**
and reported what it caught and missed. That is the strongest evidence in this ledger.

**CLOSED (9):** F48 (`:1346` `setdefault(...).append` — probe with a shadowing class still CAUGHT),
F55, F60 (`fakes.py:85,92` genuinely diverge), F66 (probe: one-key stub REFUSED), F67 (probe:
`image.repository='attacker/exfil'` alone REFUSED), F68 (`tests/test_preparation.py:1102-1113` pins
the tuple membership — **the recap at `:4313` was wrong to re-raise it**), F70 (`preparation.py` is
771 against the 800 bound — 29 free, no hand-collapse dependency), F72, F73.

**SUPERSEDED (2):** F61 → **F65** (probe: single-field `replace` REFUSED with the exact-instant
message; only the multi-field move survives). F62 → **F71** (`:2458` explicitly made F71 the standing
statement four cycles ago — **the recap at `:4313` was wrong to re-raise F62 as an open P2**).

**UNASSIGNED (4):** F56, F57, F58, F59 — zero occurrences anywhere in the body. F99 confirmed.

**OPEN P2 (9), each with a probe result:** **F45** (default-value binding edge: probe MISSED, the
argument control CAUGHT), **F46** (`:1349` skips non-`Name` callees: `_Wiring().wire(_declared(a))`
MISSED), F49 (`:1344-1346` collects `FunctionDef` only: `_wire = lambda ...` MISSED), F51 (`:1371-1377`
index unchanged after a `Starred`), F52 (false positive, disclosed at `:1314-1316`, not fixed), F53
(bare-name pooling flags an honest call), **F65** (probe: **two-field epoch forgery ACCEPTED,
`satisfied=True`; `1970`, `0001` and `2026-08-04T23:59:59Z` all ACCEPTED**), F74 (probe:
`grant.RECORD_KEYS`(2) vs `admission.RECORD_KEYS`(10), `constants.EVIDENCE_KEYS`(11) vs
`admission.EVIDENCE_KEYS`(5) still unequal — the "package-wide" claim checks one pair), F75 (residual
limb only: `replace(r, selected_image_identity=MappingProxyType({}))` still ACCEPTED, exactly as
`observe.py:306-310` discloses).

**OPEN P3 (9):** F47 (aliased callee: `_alias=_wire` MISSED, byte-identical direct call CAUGHT), F50,
F54, F63, F64, F69 (probe: moving both sides is refused by the *ordering* check at
`preparation.py:242-245`, so those two params never exercise the equality control they name), F71
(probe: `object.__setattr__` SUCCEEDS), F76 (probe: reversed seven-key identity ACCEPTED here,
REFUSED by `grant.keyed`), F77 (widened 3→6 by F81).

### Three further ledger self-contradictions, bringing this cycle's total to nine

7. **F33 left the P1 set without discharge.** `:1385` — *"This finding must be discharged by the
   entrypoint GREEN, not after it"* — and `:1857` — *"'Both callers reach it' is false"* — against
   `:2057` — *"The open P1 set is now F30 … and F39"*. F33 vanishes in the same cycle F43/F44 are
   repaired, with no line discharging it. Live source confirms the second caller still does not exist.
8. **The `:1581` register carries a wrong self-pointer.** `:1630` gives F35's location as `:1386`,
   which is the closing sentence of the **F33** entry; F35 is defined at `:1401-1412`. The register
   shape F98 asked to have re-published was already wrong about one of its own rows.
9. **F36 was graded CONFIRMED P1, named the "Exact next action" at `:1901` and the "highest-value
   next repair" at `:1920`, on a claim the ledger itself later measured false** (`:1961`: the literal
   revert raises *"a `NameError` on every run"*; `:1970`: the separating tests were pre-existing). A
   cycle of direction was issued on an unmeasured claim. This is the exact failure mode probe-based
   verification exists to prevent, and is why band 3's probes are recorded above.

### The complete register at `9439bd0` — all 102 IDs, F1..F99 plus F29-A/B/C

| bucket | count | IDs |
|---|---|---|
| **CLOSED** | **26** | F1, F2, F3, F4, F5, F7, F12, F17, F22, F23, F29, F30, F32, F36, F39, F43, F44, F48, F55, F60, F66, F67, F68, F70, F72, F73 |
| **SUPERSEDED** | **2** | F61→F65, F62→F71 |
| **UNASSIGNED** | **4** | F56, F57, F58, F59 |
| **P1 OPEN** | **4** | **F33** (deferred to the GREEN), **F83, F86, F87** |
| **P1 repaired, unreviewed** | **2** | F78, F85 |
| **P2 OPEN** | **27** | F6, F8, F9, F10, F11, F13, F16, F24, F25, F26, F29-A, F31, F37, F40, F41, F45, F46, F49, F51, F52, F53, F65, F74, F75, F88, F91, F98 |
| **P2 repaired, unreviewed** | **3** | F79, F84, F95 |
| **P3 OPEN** | **32** | F14, F15, F18, F19, F20, F21, F27, F28, F29-B, F29-C, F34, F35, F38, F42, F47, F50, F54, F63, F64, F69, F71, F76, F77, F80, F81, F82, F89, F90, F92, F93, F94, F99 |
| **P3 repaired, unreviewed** | **2** | F96, F97 |
| | **102** | reconciles exactly against F1..F99 + F29-A/B/C |

**F98 is DISCHARGED by this register** — every ID is now traced to live source by an independent
read-only verifier, and the recap is a view of the body rather than a hand-maintained list. F98
itself remains counted OPEN above until an independent verdict confirms this discharge.

**The true P2 count is 27, not the 5 the recap has been asserting.** F98(a) predicted the recap was
under-reporting; it under-reported by a factor of five. F98(a) was also wrong in two places, both
corrected here by live source: **F62 was legitimately superseded by F71**, and **F68 was legitimately
pinned** — the recap was right to drop those two and wrong about the rest.

### Push gate

**P0 = 0. P1 = 4. P2 = 27. P3 = 32.** The gate `P0 = P1 = P2 = 0` is **not met**, and for the first
time since `:3348` that statement rests on a complete, source-verified register rather than on an
unevaluable list. The atomic entrypoint GREEN stays blocked. **None of the 79-commit local range is
push-eligible.** Origin/PR #55 remains at `73ec822`, draft, CLEAN, four rendered hosted checks
SUCCESS. RUNTIME remains **HOLD**. PRODUCTION remains **Founder-only**.

### The exact next action, now that the gate is evaluable

**Repair the `preparation.py:233-234` cluster as one commit: F86 + F83 + F87 + F65.** They are not
neighbouring defects; they are four readings of one pair of lines and one recording seam five lines
below it, and band 3 has now *demonstrated* F65 by probe — a two-field `replace` carrying a 1970
epoch is **accepted with `satisfied=True`**. That is the single highest-value defect in the register.
`preparation.py` has **28 free lines**; if the four repairs plus their tests do not fit, plan the
extraction first as its own reviewed commit, which is the mistake cycle 40 made by discovering the
size wall mid-repair.

Second priority, and cheaper: **F16 and F37 both live in the same seam.** `adapter.py` has **zero**
free lines, and `CommandAdapterAccessors` is public at `observe.py:661` but absent from `__all__`.
Any repair touching either module must budget for both.

---

## Cycle 41 — re-measurement at live HEAD `3c58664`, and the lint gate that was never actually unrunnable

Measured by an independent read-only verifier and reproduced by the coordinator. Every figure below
is a live measurement at `3c58664`, not a carried-forward claim.

### Live identity

Local HEAD `3c58664`, branch `codex/uat-browser-g-u2b-db-red-gate-r1`, **80 commits ahead** of
origin. Origin/PR #55 remains at `73ec822`, **OPEN, draft, CLEAN**, four rendered hosted checks
SUCCESS (two `secret-scan`, two `contract standards validation`). The untracked
`integration/topology-rehearsal/uv.lock` is present, unmodified, sha256
`24135c76f28231b2d5201028e741cc5da85a6b8af13feaf99e6668bac6ab25eb`.

**The autonomous checkpoint this cycle was handed was stale**: it named HEAD `76553f4` and "11
commits ahead". Both were wrong by 69 commits. Live git was authoritative and was re-read first.

### Census, with all 58 failures classified rather than assumed

`uv run --offline python -m pytest tests -q` → **`58 failed, 1535 passed in 0.72s`**.

All 116 traceback lines (58 failures x 2) were swept. Every one reduces to a single source,
`tests/conftest.py:94` in `require_c8_path()`, reporting one of `scripts/`,
`scripts/prepare_topology_grant.py` or `scripts/run_topology_rehearsal.py` as absent. `ls scripts/`
confirms the **directory itself** does not exist, not merely the two files.

**58 of 58 are the intended absent-entrypoint-script RED. UNINTENDED = 0.**

`uv run --offline python -m compileall -q src tests` → exit 0, clean.

### F100 — **P2** — `docs/REVIEW-LEDGER.md`, finding F15. **NEW, OPEN. The pinned lint gate runs, and fails.**

F15 has stood since band 1 as *"`.venv/bin/ruff` absent; the pinned lint gate never ran"*, and the
open-set register carries it as a P3 documentation defect. The premise is half true and the
conclusion is false. `.venv/bin/` does hold only `pytest, python, python3, python3.12` — but
`uv run --offline ruff check src tests` **resolves `ruff` through the host `PATH`** to
`/opt/homebrew/bin/ruff` 0.16.0 and **executes**. It has been runnable this whole time.

It reports **12 errors, exit 1**, read-only `check` with no `--fix` applied:

| Site | Rule | Already tracked as |
|---|---|---|
| `observe.py:84,85` | `F401` unused import | F90 |
| `observe.py:266,272,281,286,345` | `ISC004` implicit concatenation | F94 |
| `preparation.py:53` | `F401` unused `PRESENT_KEY` | F80 |
| `preparation.py:628,662` | `ISC004` implicit concatenation | F94 |
| `tests/test_errors.py:12` | `I001` unsorted import block | **NEW — untracked** |
| `tests/test_runner.py:3` | `I001` unsorted import block | **NEW — untracked** |

Two consequences, and the second is the one that matters:

1. **F15 must be re-scoped**, not closed: the accurate finding is *"ruff is absent from the project
   `.venv`, so the gate's availability depends on host `PATH` and is not reproducible in a clean
   environment"* — a real supply-chain-of-evidence defect. Its severity as written (P3) understated
   a gate that was reporting real failures nobody read.
2. **The lint gate is a FAILING gate at live HEAD**, and has been recorded as unrunnable rather than
   failing. Ten of the twelve errors independently corroborate F80, F90 and F94 from a second tool;
   the two `I001` findings are new and were never opened by any review.

No auto-fixer was run and none may be: `--fix` is a formatter action requiring Founder authority
under this repository's `CLAUDE.md`, and `observe.py:84,85` is the deliberate F90 re-export seam
that `preparation.py:52,54` depends on — `--fix` would delete a load-bearing import and break the
package. This is exactly why the gate must be read by a human and not auto-applied.

### F86 mechanism confirmed by direct probe, not by assertion

The coordinator independently reproduced the `.get` delegation hazard that F83/F86 turn on:

```
class G(dict):
    def get(self, k, d=None): return 'FORGED' if k=='observed_at' else dict.get(self,k,d)
p = MappingProxyType(G({'observed_at':'GENUINE'}))
  type(p) is MappingProxyType -> True
  p.get('observed_at')        -> 'FORGED'
  p['observed_at']            -> 'GENUINE'
  dict(p.items())             -> 'GENUINE'
```

A `dict` subclass overriding **only** `get`, wrapped in `MappingProxyType`, passes the
`type(value) is not MappingProxyType` gate in `PreparationResult.__post_init__` and the deep
immutability proof, while `.get` diverges from **both** views `views.stored_entries` reconciles.
`preparation.py:233` binds `signed` through exactly that `.get`, and `:243` reads the live reading's
instant the same way. **F86 and F83 are CONFIRMED by measurement, not merely re-asserted.**

### Size headroom re-measured, and two modules are at the wall

| Module | Lines | Free to the strict `< 800` bound |
|---|---:|---:|
| `adapter.py` | 799 | **1** |
| `grant.py` | 794 | **6** |
| `preparation.py` | 771 | 29 |
| `runner.py` | 756 | 44 |
| `admission.py` | 725 | 75 |
| `observe.py` | 693 | 107 |

Bound source `tests/test_surface_contract.py:95-96` (`MODULE_LINE_LIMIT = 800`), enforced at `:247`
by `>= MODULE_LINE_LIMIT`. `adapter.py` is **one line** from tripping the gate; `grant.py` is six.
Any repair touching either must plan its extraction as a separate reviewed commit first.

### Push gate at `3c58664`

**P0 = 0. P1 = 4** (F33 deferred to the GREEN; F83, F86, F87). **P2 = 28** (the 27 of the `9439bd0`
register, plus F100). **P3 = 32.** The gate `P0 = P1 = P2 = 0` is **not met**. The atomic entrypoint
GREEN stays blocked. **None of the 80-commit local range is push-eligible.** RUNTIME remains
**HOLD**. PRODUCTION remains **Founder-only**.

### Exact next action

Unchanged in target, sharpened by this cycle's probe: **repair the `preparation.py:233-243` `.get`
cluster (F86 + F83) test-first**, reading both instants from what the mapping *stores* via
`views.stored_entries` and refusing a mapping whose two views diverge, before any binding is
compared. The probe above is the ready-made RED. Budget 29 free lines in `preparation.py`. F87 and
F65 are the same seam but a separate commit; F100's two new `I001` sites are cheap and independent.

### F86 and F83 — repair landed at `186c1a7`. Status: **REPAIRED-UNREVIEWED**, not closed.

Test-first, `ad08b19` (RED) then `186c1a7` (GREEN). Four tests added to `tests/test_preparation.py`.

The RED did not rest on a bare `DID NOT RAISE`. It constructed a **satisfied** `PreparationResult`
and printed the divergence it had accepted:

```
AssertionError: a satisfied result bound granted_observed_at '2026-08-05T00:00:00Z'
                to a signed identity that stores '1970-01-01T00:00:00Z'
AssertionError: a satisfied result pinned to '2026-08-05T00:00:00Z' recorded a live
                reading that stores the older '2026-08-04T23:59:59Z'
```

Two **premise** tests, passing before the fix, pin that the forged mapping clears the
`type(value) is not MappingProxyType` gate, `immutability_findings` **and** `stored_entries`
divergence. That is what makes this a targeted repair rather than an incidentally green one: every
other gate admitted the liar, and only the unreconciled third accessor did the damage.

GREEN reads both instants from `stored_entries` snapshots and refuses a mapping whose two views
diverge **before** either instant is compared. `dict.get` on a plain snapshot is the C
implementation, so the third-protocol seam is removed rather than relocated. The subscript
cross-check is kept, not dropped. `stored_entries` joins the existing `.observe` import block,
preserving the F81/F90 re-export seam. No existing test, message or check ordering changed.

Measured: `tests/test_preparation.py` 355 passed; broad census `58 failed, 1539 passed`
(1535 -> 1539 is exactly the four added tests; the 58 are the unchanged absent-entrypoint REDs);
`compileall -q src tests` exit 0.

**Size cost, and the constraint it creates:** `preparation.py` 771 -> **793** of a strict `< 800`
bound. **Seven free lines.** This module now joins `adapter.py` (1 free) and `grant.py` (6 free) at
the wall. **F87 and F65 live in this same seam and no longer fit**: their repair must plan an
extraction as its own separately reviewed commit *first*, which is precisely the mistake cycle 40
made by hitting the size wall mid-repair.

**Not closed, and not push-eligible.** This is authority-sensitive code and owes an independent
Opus verdict on `3c58664..186c1a7`. Until that verdict exists these count as REPAIRED-UNREVIEWED,
exactly like F78, F79, F84, F85, F95, F96 and F97 before them. The register's P1 line therefore
reads: **P1 OPEN = 2** (F33 deferred to the GREEN; F87), **P1 repaired-unreviewed = 4**
(F78, F85, F83, F86). P2 = 28, P3 = 32. The push gate `P0 = P1 = P2 = 0` remains **not met**.

---

## Cycle 45 — every static gate re-measured at live HEAD `721815b`, and the F83/F86 repair sent for its owed independent verdict

Measured by an independent read-only verifier and reproduced against the coordinator's own broad
census. Every figure below is a live measurement at `721815b`, not a carried-forward claim.

### Live identity

Local HEAD `721815b`, branch `codex/uat-browser-g-u2b-db-red-gate-r1`, **84 commits ahead** of
origin. Origin/PR #55 remains at `73ec822`, **OPEN, draft, `CLEAN`**, four rendered hosted checks
SUCCESS (two `secret-scan`, two `contract standards validation`, workflow `contracts`, all
completed `2026-08-05T11:27-11:29Z`). The untracked `integration/topology-rehearsal/uv.lock` is the
**only** untracked entry, unmodified, sha256
`24135c76f28231b2d5201028e741cc5da85a6b8af13feaf99e6668bac6ab25eb`.

**The autonomous checkpoint this cycle was handed was stale again**, and by more than last time: it
named HEAD `76553f4` and "11 commits ahead". Live git was 84 ahead at `721815b` — the checkpoint was
wrong by 73 commits. Live git and `gh pr view` were re-read first and are the only figures recorded
here. This is now the second consecutive cycle in which the supplied checkpoint was stale by dozens
of commits; the ledger, not the checkpoint, is the durable record.

### Census, with all 58 failures classified rather than assumed

`.venv/bin/python -m pytest tests -q` → **`58 failed, 1539 passed in 0.74s`**.

Every one of the 58 was traced to its raising site rather than counted. All 58 reduce to the single
guard `require_c8_path()` at `tests/conftest.py:94`, which fails closed with *"missing C8
implementation — this RED test states the final runner behaviour and fails closed until it
exists"*. The subjects break down exactly as:

| Reported absent subject | Failures |
|---|---:|
| `scripts/run_topology_rehearsal.py` | 49 |
| `scripts/prepare_topology_grant.py` | 8 |
| `scripts` (the directory itself) | 1 |
| **Total** | **58** |

`ls scripts/` → `No such file or directory`; the directory itself is absent, not merely its two
files. **58 of 58 are the intended absent-entrypoint-script RED. UNINTENDED = 0.**

The count moved 1535 → 1539 across cycles 41→45 and that delta is exactly the four tests the
F83/F86 repair added to `tests/test_preparation.py`. No test was deleted or weakened to obtain it.

### Focused suites, measured separately

| Suite | Result |
|---|---|
| `tests/test_preparation.py` | 355 passed |
| `tests/test_adapter.py` | 366 passed |
| `tests/test_observe.py` | 157 passed |
| `tests/test_runner.py` | 96 passed |
| `tests/test_surface_contract.py` | **7 failed**, 80 passed |

The seven are inside the 58 and are the same absent-scripts RED
(`test_both_inert_entrypoints_exist`, `test_the_scripts_root_holds_exactly_the_two_entrypoints`,
`test_both_entrypoints_import_and_carry_a_docstring`, parameterised over the two script names).
This figure is recorded named-and-per-file **because F97 opened on this ledger's habit of quoting an
irreproducible aggregate "focused six-file set" number**; the five suites above are named exactly so
the figure can be reproduced.

`.venv/bin/python -m compileall -q src tests` → **exit 0**.

### The lint gate re-read: still 12 errors, and two of F94's anchors had already gone stale

`ruff check src tests`, `/opt/homebrew/bin/ruff` 0.16.0, read-only, **no `--fix` applied and none
permitted** → **12 errors, exit 1**. Unchanged in count and composition from cycle 41, with one
correction this cycle forces:

| Site | Rule | Tracked as |
|---|---|---|
| `observe.py:84,85` | `F401` | F90 |
| `observe.py:266,272,281,286,345` | `ISC004` | F94 |
| `preparation.py:53` | `F401` | F80 |
| `preparation.py:650,684` | `ISC004` | F94 — **anchors corrected, were `628,662`** |
| `tests/test_errors.py:12` | `I001` | F100, untracked by any earlier review |
| `tests/test_runner.py:3` | `I001` | F100, untracked by any earlier review |

The two `preparation.py` `ISC004` sites moved `628,662` → `650,684`, displaced by the 22 lines the
F83/F86 repair inserted above them. This is **F91 recurring on schedule**: the ledger's own line
anchors are invalidated by any commit that inserts above them, and F94's anchors were stale within
one cycle of being written. The anchors are corrected here; F91 stays open because the mechanism
that keeps breaking them is unaddressed, not because this one instance is unrepaired.

`ruff check --select I001 --diff` (read-only preview, nothing applied) shows both `I001` sites are
pure reorderings of already-present imports with no semantic change — `import fakes` before
`import pytest` in `tests/test_errors.py`, and `import documents, fakes` merged ahead of `pytest` in
`tests/test_runner.py`. **They are not repaired in this cycle, and the reason is a real decision
this ledger owes rather than an omission**: ruff classifies `fakes`, `documents` and `conftest` as
third-party because nothing declares them first-party, so its preferred ordering merges the local
test helpers into the `pytest` block and destroys the stdlib / third-party / local-helper grouping
both files use deliberately. The two available repairs are not equivalent — accepting ruff's
ordering changes the files, whereas declaring `known-first-party = ["fakes", "documents",
"conftest"]` in `pyproject.toml` changes the *gate's configuration* and would silently re-grade
every import block in the component. The second is a lint-gate change and must be reviewed as one.
Neither may be obtained by running `--fix`: `--fix` is a formatter action requiring Founder
authority under this repository's `CLAUDE.md`, and it would additionally delete the F90 re-export
seam at `observe.py:84,85` that `preparation.py:52,54` load-bears on, breaking the package.

### Size headroom re-measured — three modules are now at the wall, not two

| Module | Lines | Free to the strict `< 800` bound |
|---|---:|---:|
| `adapter.py` | 799 | **1** |
| `grant.py` | 794 | **6** |
| `preparation.py` | 793 | **7** |
| `runner.py` | 756 | 44 |
| `admission.py` | 725 | 75 |
| `observe.py` | 693 | 107 |
| `plan.py` | 533 | 267 |
| `protocols.py` | 382 | 418 |
| `constants.py` | 264 | 536 |
| `views.py` | 163 | 637 |
| `errors.py` | 159 | 641 |
| `__init__.py` | 11 | 789 |

Bound source `tests/test_surface_contract.py:96` (`MODULE_LINE_LIMIT = 800`), enforced at `:247` by
`>= MODULE_LINE_LIMIT`. `preparation.py` joined `adapter.py` and `grant.py` at the wall as the
direct cost of the F83/F86 repair (771 → 793). **F87 and F65 live in `preparation.py`'s seam and no
longer fit**: their repair owes a separately reviewed extraction commit *first*. That is precisely
the mistake cycle 40 made by hitting the size wall mid-repair, and it is now structural rather than
incidental — three of the twelve modules cannot absorb a repair of any size.

### F101 — **P3** — `docs/REVIEW-LEDGER.md`, every `## Cycle` heading. **NEW, OPEN.**

The cycle headings are not a monotonic index and cannot be used to locate the latest state. At live
HEAD the sequence ends `:4414` Cycle 44, `:4629` Cycle 44 (addendum), `:4764` **Cycle 41** — a
section written after Cycle 44 and labelled with a number three lower, describing a HEAD (`3c58664`)
that post-dates both Cycle 44 sections. Two distinct sections at `:4005` and `:4154` are both
labelled "Cycle 43" with different subjects, and cycles 23, 25 and 30–35 have no heading at all.

This is the same class of defect as F98 — a navigational index that does not describe the body it
indexes — and it has the same consequence: a reader taking the last `## Cycle` heading as the
current state lands on a section that is neither the newest nor uniquely numbered. **The durable
identifier is the recorded HEAD sha, not the cycle number**, and every section from `:4764` onward
does record one. No repair is attempted here: renumbering 45 headings is a large mechanical edit
with real risk of breaking the `:NNNN` line references other findings depend on, and it must be
scoped as its own commit.

### Control-weakening sweep over the whole local range — clean, and each deletion accounted for

The push gate forbids weakening the surface, inertness, single-spawn-site, anti-self-witnessing,
fail-closed and file-size controls to obtain GREEN. That has been asserted each cycle and not
measured across the range as a whole, so it was measured here. `git diff 73ec822..HEAD -- tests`
was swept for every removed line matching `assert`, `pytest.raises` or `def test_`. **Exactly nine
lines were removed, in two clusters, and both clusters are documented deliberate withdrawals rather
than concessions:**

| Removed | Cluster | Accounted for by |
|---|---|---|
| `def test_runner_exports_only_the_result_and_single_entrypoint` + 4 argv/exit assertions | the raw-runner publication withdrawal | `6bc0745`, spec `:224-269` — the `.runner` accessor is itself the authority defect |
| `def test_runtime_wiring_injects_the_one_executor_into_every_command_adapter` + `adapter.runner is command_runner`, `adapter.plan is wiring.plan`, `wiring.command_adapters[name].runner is wiring.command_runner` | the same withdrawal at the wiring seam | `f6622d4` restored the single-executor control on the default wiring path *without* re-publishing the executor |

Both clusters remove assertions that **required** every command adapter to hand out its executor.
Deleting them is the F9/Obstacle-3 repair, not a relaxation: the control they carried
(one executor, one spawn site) survives at `f6622d4` in a form that does not demand publication.
The spec's own note at `:224` — *"the `.runner` accessor the wiring RED asks for is an authority
defect"* — is the adjudication, and `69ed068` supplies the replacement seam (*"let every command
adapter name its plan without handing out its executor"*).

**Nothing else was removed.** No size bound, no inertness check, no fail-closed guard and no
anti-self-witnessing control lost an assertion anywhere in the 84-commit range. F18 remains open
against the spec for still *naming* the second deleted test at `ENTRYPOINT-SLICE-SPEC.md:167` after
its removal — the deletion is sound, the spec's reference to it is stale.

### F87 escalated to an authority bypass by adversarial probe. **P1, OPEN, and worse than recorded.**

An independent adversarial verifier was tasked to **refute** F87 and could not. It is REAL, its
mechanism is confirmed by running probe, and its blast radius is larger than this ledger claimed.

**The mechanism is object aliasing, not value forgery.** `views.stored_entries` snapshots into a
local `dict` at `views.py:126` (`stored = dict(mapping.items())`); every validation then judges that
snapshot, while the dataclass field keeps the **caller's live mapping**. Measured directly:
`result.granted_image_identity is probe` → `True`. Nothing binds read *k* to read *k+1*, so a
mapping that is honest for the reads validation consumes and hostile afterwards is accepted.

The probe counted the read budget first, then straddled it. A `dict` subclass hostile after N reads
— consistently across `items()`, `__getitem__`, `__iter__` **and** `.get` — wrapped in
`MappingProxyType`, is exactly `MappingProxyType` by `type()`, so it clears the field-type gate at
`preparation.py:205-209` and `immutability_findings`:

```
protocol reads consumed by validation: {'items': 3, 'getitem': 14, 'iter': 1, 'get': 0}
ACCEPTED, satisfied = True
--- what the RECORDED field says AFTER validation ---
by iteration : attacker/exfil / EXFIL
by subscript : attacker/exfil / EXFIL
by .get      : attacker/exfil
preparation.frozen(recorded field) = attacker/exfil / EXFIL
recorded field IS the caller's object: True
```

**The escalation this ledger owed and did not have.** F87 was recorded as reaching only `frozen()`
and auditors. A second probe on the `image` field, gated on a 22-read total-access counter, reached
the live consumption path:

```
total protocol reads validation consumes on `image` = 22
ACCEPTED, satisfied = True | reads used = 22
runner._attempt_names(...).image_reference =
    attacker/exfil@sha256:3333…3333
```

`runner._attempt_names` names the attempt off `attacker/exfil` — **an authority bypass on the live
path, with no field-value change and no epoch trick. Every value the validator read was genuine.**
This is not a documentation or auditor-visibility defect; it is the anti-self-witnessing control
failing against a mapping that answers honestly exactly as long as anyone is checking.

`views.py:100-101` — *"every recorded copy carries exactly what `.items()` yielded"* — is
**false** on the `dataclasses.replace` path, and is the claim that made this look closed.

**Anchor corrections (F91 again).** The ledger's `preparation.py:710-731` for `frozen()`'s call site
is stale by ~22 lines. Verified at `721815b`: `frozen` is defined at `preparation.py:129`; its
**only** call site is `snapshot()` at `preparation.py:728-756`, with
`granted_image_identity=frozen(...)` at `:753`. Live anchors: `views.py:126` (the single read),
`views.py:130` (`subscripted = mapping[key]` — a *second* read, not a binding on the first),
`preparation.py:196-197` (the two pinned fields), `:113-117` (`FROZEN_MAPPING_FIELDS`), `:199`
(`__post_init__`), `:215-218` (the `immutability_findings` loop), `:246-248` and `:251` (the two
`stored_entries` calls the F83/F86 repair added), `:259` (`signed_identity_findings`),
`observe.py:292,336`, `grant.py:315` (`inventory = tuple(value)`), and the live consumers
`runner.py:279-280,332,340,591`.

### The F87 repair is one line and needs no extraction commit — the size blocker was wrong

This ledger recorded at cycle 43 and again above that F87 *"no longer fits"* in `preparation.py`'s
7 free lines and owes a separately reviewed extraction first. **That is refuted.** The minimal
repair rebinds each field to a dead copy inside the loop that already proves it immutable, at
`preparation.py:219`:

```python
        for name in (*FROZEN_MAPPING_FIELDS, *FROZEN_SEQUENCE_FIELDS):
            nested = immutability_findings(getattr(self, name), name)
            if nested:
                raise ValueError(f"{name} is not a deep proof: " + "; ".join(nested))
            object.__setattr__(self, name, frozen(getattr(self, name)))   # <- the whole repair
```

`preparation.py` 793 → **794**, six free lines remain against the strict `< 800` bound. `frozen` is
already in-module at `:129`, so no import is added. Placed at `:219` it runs **before** the
`stored_entries` calls at `:246`/`:251`, so those reconcile a dead copy and validate-then-record
collapses into **record-then-validate**. Verified against the probe:

```
after frozen(): type = mappingproxy | subscript = postgres | items = postgres
```

`frozen()` rebuilds recursively into fresh `MappingProxyType`-over-plain-`dict`, so the recorded
object retains no live accessor and performs one `.items()` read whose result is both validated and
recorded — exactly the property F87 says is missing. Because the loop covers all of
`FROZEN_MAPPING_FIELDS` and `FROZEN_SEQUENCE_FIELDS`, the same line also closes the
never-snapshotted fields, including `selected_image_identity`, which `observe.py:307-310` explicitly
declares unvalidated.

The honest doc repair belongs at `views.py:100-101` (163 lines, 636 free), not in `preparation.py`,
and the now partly-obsolete 12-line comment at `preparation.py:234-245` **frees** lines rather than
consuming them. **No extraction commit is required. The cycle-43 size blocker on F87 is withdrawn.**

### F65 is distinct from F87, measured in both directions

- F65 reproduces at HEAD with a **stable** forgery honest on every protocol forever:
  `MappingProxyType({**genuine, "observed_at": "1970-01-01T00:00:00Z"})` →
  `ACCEPTED: True | attempt_id -> 19700101T000000Z-c8`. It defeats validation by **content** — a
  copy holds no authorization — not by time.
- The F87 repair does not touch it: `frozen()` of the F65 forgery still reports
  `observed_at = 1970-01-01T00:00:00Z`.
- Conversely F87 needs no value change at all; its honest face is byte-identical to the genuine
  identity. F65's authority residual is not its cause.

F87 is likewise distinct from F85/F86, which are third-protocol (`.get`) holes on a *stable*
mapping. This ledger's note at `:3596` that *"F85/F86/F87 are one defect wearing three faces"* was
right that patching `.get` alone leaves F87 standing — the F87 mapping is consistent across all four
protocols at every instant. **The F83/F86 repair landed at `186c1a7` does not close F87 and was
never claimed to.**

### Exact next action, sharpened

**Repair F87 test-first at `preparation.py:219`**, with a RED that is the probe above — a
read-budget-straddling mapping accepted with `satisfied = True` whose recorded field then names
`attacker/exfil`, asserted through `runner._attempt_names(...).image_reference` so the RED states
the **authority bypass**, not merely the aliasing. Repair `views.py:100-101`'s false claim in the
same commit. Budget one source line. This is authority-sensitive and owes an independent Opus
verdict before push, exactly as F83/F86 still do.

### Reviews outstanding at the close of this cycle

Two lanes were still running when the cycle window closed and their verdicts are **OWED, not
absent-therefore-clean**:

1. the full-range independent Opus review of `3c58664..721815b` — the verdict the F83/F86 repair
   owes before it can move from REPAIRED-UNREVIEWED to closed;
2. the mechanical ledger register cross-check (computed status totals vs. the register's claimed
   P1 = 2 + 4, P2 = 28, P3 = 32; severity contradictions such as F16's P3-vs-P2).

Both must be re-commissioned next cycle. **No finding is discharged by their absence.**

### The register cross-check returned: **ACCURATE**, and it found one new defect

The second owed lane landed after the cycle window and is recorded here rather than dropped. It
audited the ledger content pinned at `721815b` (confirmed byte-identical: `git diff 721815b e0f6903`
is a pure append, 0 deletions), recomputing every finding's last-recorded status independently.

**The register at `:4716-4729` is ACCURATE.** Recomputed from the Cycle 44 four-band sweep:
CLOSED 26, SUPERSEDED 2, UNASSIGNED 4, P1 OPEN 4, P1 repaired-unreviewed 2, P2 OPEN 27,
P2 repaired-unreviewed 3, P3 OPEN 32, P3 repaired-unreviewed 2 = **102**, reconciling exactly with
the register's own claimed total. After the F100 and F83/F86 amendments: P1 OPEN 2,
P1 repaired-unreviewed 4, P2 OPEN 28, P3 OPEN 32 = **103 slots**, matching the complete ID set
(F1..F100 plus F29-A/B/C). **No ID appears in the register and not the body, or in the body and not
the register, in either direction.** After F98's discharge the register is a true view of the body.

**F99 is confirmed by independent count.** F56-F59 appear nowhere except inside the sentences
documenting the gap; they were never assigned. The audit also excluded 13 `F401` grep hits as the
ruff rule code, not a finding ID — a trap worth recording for anyone re-running this count.

**F16 is the only unreconciled severity**, P3 at `:1611` against P2 at `:1858`, `:4497`, `:4546`,
and the ledger already self-flags it at `:4545-4547`. The apparent P1→P2/P3 shifts of F45, F46, F47
and F65 are **not** inconsistencies: they were formally re-graded by the named second independent
opinion landing at `:3245`. F60/F61's P1→CLOSED/SUPERSEDED is narrated at `:2462-2465`.

### F102 — **P2** — `docs/REVIEW-LEDGER.md`, findings F95, F96, F97. **NEW, OPEN.**

Nine findings carry REPAIRED-UNREVIEWED at EOF: F78, F79, F83, F84, F85, F86, F95, F96, F97. Each
owes an independent verdict, and a verdict can only be commissioned against a diff. **F95, F96 and
F97 name no commit at all** — `:3978`, `:4096` and `:4329` say only *"REPAIRED in this cycle"*, and
no commit hash for their repair appears anywhere in the file. **Their independent review cannot be
scoped from this ledger's own text.** F79 is a weaker instance of the same defect: its repair is
recoverable only by inference from F78's `f2bb2c5` at `:3070`, and its own register row at `:4518`
names no commit.

This is the mechanism that has produced three lost reviews already. A finding recorded as repaired
but not attributable to a diff is **indistinguishable from an unrepaired one** to the next reviewer,
and the honest status of F95/F96/F97 is therefore not REPAIRED-UNREVIEWED but *unverifiable without
a `git log -S` archaeology pass*. By contrast F83 and F86 are the only two carrying a true bracketed
range (`3c58664..186c1a7`, `:4877`, `:4913`); F78, F84 and F85 name a single commit, which is
functionally a one-commit range and is sufficient.

**Repair:** every future REPAIRED-UNREVIEWED entry must carry the exact commit or range in its own
register row at the moment it is written, not in surrounding prose. F95, F96 and F97 owe a
`git log -S` recovery of their repair commits before their verdicts can be commissioned.

### Push gate at `721815b` / `3631431`

**P0 = 0. P1 OPEN = 2** (F33 deferred to the GREEN; **F87, now escalated to a confirmed authority
bypass**). **P1 repaired-unreviewed = 4** (F78, F85, F83, F86). **P2 = 29** (F102 added).
**P3 = 33** (F101 added).
The gate `P0 = P1 = P2 = 0` is **not met**. The atomic entrypoint GREEN stays blocked. **None of the
86-commit local range is push-eligible.** RUNTIME remains **HOLD**. PRODUCTION remains
**Founder-only**.

## Cycle 46 — the 58-RED census proved absent-script by traceback, the lint baseline pinned exactly, and F87's repair opened

Measured at live HEAD `e4fc29c`, local range `73ec822..e4fc29c` (88 commits ahead of origin), on a
tree carrying no modification but the untracked `uv.lock`.

### The census claim is no longer an assumption. **ACCURATE, and now proved by mechanism.**

Prior cycles asserted *"all 58 REDs are absent-script"* from the shape of the test names. An
independent verifier was tasked to **refute** it by reading tracebacks rather than names, and could
not. Measured: **58 failed / 1539 passed**, of which **58 are ABSENT-SCRIPT and 0 are OTHER**.

The mechanism is a single guard, not 33 coincidences. Every one of the **33 distinct failing test
functions** begins its body by calling `load_c8_script(...)` or `require_c8_path(...)`, which reaches
`tests/conftest.py:91-95`:

```python
def require_c8_path(path: Path) -> Path:
    if not path.exists():
        pytest.fail(f"{_MISSING_C8}: {path} does not exist", pytrace=False)
    return path
```

All 58 failing node-ids reproduce the identical frame `tests/conftest.py:94: Failed: missing C8
implementation`. `ls scripts` returns *"No such file or directory"* — the root itself is absent, so
this is not an assertion about incidental behaviour. The arithmetic closes exactly: 29 functions in
`tests/test_scripts_inert.py` yield 51 node-ids, 4 in `tests/test_surface_contract.py` yield 7,
and 51 + 7 = 58.

**Consequence:** no failure in this range is a regression against existing source. Every RED is
discharged by the atomic entrypoint GREEN and by nothing else.

### F100's lint gate re-measured, and its baseline pinned for the first time

`uv run --frozen ruff check src tests` runs and reports **exactly 12 errors** at `e4fc29c`. The
complete baseline, so any future cycle can tell a new error from an inherited one:

| Rule | Sites |
|---|---|
| `F401` unused import | `observe.py:84,85` (F90's re-export seam), `preparation.py:53` (F80's dead `PRESENT_KEY`) |
| `ISC004` unparenthesized implicit concatenation | `observe.py:266,272,281,286,345`; `preparation.py:650,684` |
| `I001` unsorted import block | `tests/test_errors.py:12`, `tests/test_runner.py:3` |

Five are auto-fixable and seven more only under `--unsafe-fixes`. **No fixer was run** — running a
formatter or auto-fixer requires Founder approval under `CLAUDE.md`, and F80/F90 record that two of
these `F401`s are load-bearing re-exports whose "fix" would break `preparation.py:52,54`. The lint
gate is therefore *measured*, not *satisfied*.

### F94's `preparation.py` anchors are stale — F91 recurring a third time

`:4533` records F94's preparation sites as *"`preparation.py:628,662` exact"*. At live HEAD the
`ISC004` sites in that file are **`:650` and `:684`**, a drift of 22 lines — the same magnitude and
the same cause as the `frozen()` anchor drift corrected at `:5127`. The `observe.py` half
(`:266,272,281,286,345`) is confirmed exact. **F91 is re-confirmed OPEN**: this ledger's anchors
decay faster than its cycles verify them, and F94's row is corrected here rather than re-asserted.

### F87 — the repair is open, test-first, and not yet independently reviewed

`:5083-5199` escalated F87 to a **confirmed authority bypass** and withdrew its size blocker. This
cycle independently re-confirmed the consumption path it lands on before commissioning any edit:
`runner.py:743` calls `_attempt_names(prepared)`, which at `runner.py:332` binds `selected =
prepared.image` and derives `image_reference` from it. That is the live path the probe reached, so
the RED owed is an **authority** assertion, not an aliasing one.

The repair is the single line at the immutability loop in `PreparationResult.__post_init__`,
`object.__setattr__(self, name, frozen(getattr(self, name)))`, which collapses validate-then-record
into record-then-validate for all ten `FROZEN_MAPPING_FIELDS` + `FROZEN_SEQUENCE_FIELDS`. Budget
confirmed at HEAD: `preparation.py` is **793** lines against the strict `< 800` bound, so one added
line leaves six free and no extraction commit is owed.

Note that this repair *makes true* the claim at `views.py:99-101` that F87 called false — once every
field is re-frozen at construction, including on the `dataclasses.replace` path, every recorded copy
does carry what `.items()` yielded. The doc correction owed there is therefore a **narrowing to the
construction path**, not a retraction, and no control is weakened to obtain it.

**Status: F87 remains P1 OPEN.** The repair was commissioned in this cycle and, if it lands, it lands
as REPAIRED-UNREVIEWED with its exact commit named in its own register row per `:5253`. It does not
close, and it does not move the push gate, until an independent Opus verdict returns.

### Two risks this cycle deliberately did not resolve

The repair re-runs `frozen()` over values that already passed `immutability_findings`. Two
fail-closed false-positive hazards were identified and are **not yet measured**:

1. **Double-freeze refusal.** `frozen()` at `preparation.py:129` refuses a subclass of an
   `IMMUTABLE_LEAVES` type outright. If any value that passes `immutability_findings` would make
   `frozen()` raise, a previously accepted honest construction becomes a refusal.
2. **DAG-as-cycle refusal.** `frozen()` guards recursion with `if id(value) in seen`. A value shared
   at two *sibling* positions is not a cycle but may share an id. If the `trail` is not per-branch,
   an honest DAG is refused as a self-reference.

Both are **open questions against the repair**, not against HEAD, and either one turns this repair
from a fix into a new fail-closed defect. Neither may be assumed benign.

### F103 — **P1** — `preparation.py:219`. **NEW, OPEN. The F87 repair as specified weakens a fail-closed control.**

The repair was applied exactly as `:5145` specified and **measured**, not assumed. It does not hold.

Baseline at `e4fc29c` is 58 failed / 1539 passed, all 58 absent-script. With the one line applied and
the F87 RED added, the census is **60 failed / 1538 passed** — **two new failures, neither of them
absent-script**:

```
FAILED tests/test_observe.py::test_a_proved_result_refuses_an_unreadable_reading_as_a_value_error
FAILED tests/test_observe.py::test_a_proved_result_refuses_an_unreadable_signed_identity_as_a_value_error
E       Failed: DID NOT RAISE ValueError
tests/test_observe.py:893
```

**Mechanism.** `:5145` argued the line must sit at `:219` *"before the `stored_entries` calls at
`:246`/`:251`, so those reconcile a dead copy"*. That is precisely the defect. `frozen()` rebuilds a
mapping from `.items()` into a fresh plain `dict` under `MappingProxyType`, which **discards the
caller's `__getitem__`**. By the time `stored_entries` runs, the two views it exists to reconcile are
the same object's, so they can never disagree. A `SubscriptRefuser` — a mapping that stores honest
values and refuses to be subscripted — was refused with `ValueError` at HEAD and is now **silently
accepted**.

The divergence cross-check built by F78, F83 and F86 is therefore **not repaired but rendered
vacuous**: it becomes unreachable code that can no longer refuse anything. Normalizing a hostile
mapping to its `.items()` answer is not the same as refusing it, and these two tests state that the
refusal must arrive as `ValueError` so a caller catching it around a copy still catches it.

**This is a control-weakening obtained in exchange for GREEN and is barred outright.** The repair is
**not** committed as a fix and **must not** be pushed.

**Why the obvious re-placement also fails.** Moving the line to the *end* of `__post_init__` does not
work either: the freeze itself performs one further `.items()` read, and an F87 mapping straddling
its read budget answers that read hostilely, so validation would judge honest values while the
recorded copy carried attacker content — the original bypass, relocated. F87 needs the dead copy
taken **and** the divergence of the live object still detected, which is two reads that must be bound
to each other. **The one-line repair `:5199` called sufficient is refuted; F87's real repair is not
one line.**

**Status:** F87 stays **P1 OPEN**, its specified repair withdrawn. F103 is **P1 OPEN** against that
specification. Both owe an independent Opus verdict on the corrected design before any code lands.

### Push gate at `e4fc29c`

**P0 = 0. P1 OPEN = 3** — F33 (deferred to the GREEN); F87 (an escalated authority bypass whose
specified one-line repair this cycle **refuted by measurement**); and **F103** (that specification's
control-weakening). **P1 repaired-unreviewed = 4** (F78, F85, F83, F86). **P2 = 29.** **P3 = 33.**
The gate `P0 = P1 = P2 = 0` is **not met**. The atomic entrypoint GREEN stays blocked. **None of the
88-commit local range is push-eligible.** Origin/PR #55 remains at `73ec822`, OPEN, draft, `CLEAN`,
four rendered hosted checks SUCCESS. RUNTIME remains **HOLD**. PRODUCTION remains **Founder-only**.


### F104 — **P1** — `preparation.py:224-230`. **NEW, OPEN. The candidate F87 repair relocates the bypass into `frozen()` itself.**

The uncommitted candidate repair (freeze each proved field, but reconcile the *live* object's two
views with `stored_entries` first, so F103's `SubscriptRefuser` refusal survives) was **measured, not
assumed**. It does not close F87.

**Measured evidence, current working tree.** A `dict` subclass budgeting all four protocols
(`.items()`, `__iter__`, `__getitem__`, `.get`) together, under `MappingProxyType`, was applied to
**both** `image` and `granted_image_identity` at once. Total live reads spent per field: **image 11,
granted_image_identity 10**. The last of those is the read `frozen()` itself spends rebuilding from
`.items()` at `preparation.py:151`. Setting each budget to `total - 1` — honest through
`immutability_findings` and through the new live divergence check, hostile at the freeze read:

```
off=0 ACCEPTED ref='attacker/exfil@sha256:eeee…'  BYPASS
off=1 ACCEPTED ref='attacker/exfil@sha256:eeee…'  BYPASS
off=2 ACCEPTED ref='attacker/exfil@sha256:eeee…'  BYPASS
```

`satisfied` is `True`, and `runner._attempt_names` renders the attacker's image reference for the one
authorized attempt. This is the exact hazard `:5199` predicted: *"the freeze itself performs one
further `.items()` read, and an F87 mapping straddling its read budget answers that read hostilely."*

**Why the single-field attack is not enough, and why that does not save the repair.** Flipping
`image` alone is still refused: `signed_identity_findings` at `:271` compares the recorded image
against the signed identity and reports drift. The attacker simply budgets **both** caller-supplied
mappings to flip at their own freeze read, so the two agree on attacker content and the cross-check
passes. Any repair that leaves the dead copy to be taken by a *further* live read is defeated the
same way, whatever cross-checks follow it.

**The new test is GREEN for the wrong reason.** `test_a_satisfied_result_may_not_record_a_mapping_
that_can_still_answer` measures the budget with an unreachable budget first and then sets
`budget = spent`, where `spent` *includes* the freeze's own read. It therefore pins only the variant
where the mapping stays honest for the whole of construction. It is a genuine RED against HEAD —
independently reproduced on an isolated `/tmp` copy of HEAD's source, failing with the attacker
reference reached after 25 reads — but it is **not** a sufficient GREEN gate, and it must not be
recorded as one.

**Status.** F87 stays **P1 OPEN — defect stands**. F104 is **P1 OPEN** against the candidate. The
candidate's source and test remain **uncommitted**; they are not a fix and must not be pushed. What
the candidate *does* establish and keep: F103 is not repeated (both
`test_a_proved_result_refuses_an_unreadable_*_as_a_value_error` pass), and the direct-alias variant
is closed. F87's real repair must bind the dead copy to the validated read — one read, whose result
is both judged and recorded — rather than re-reading the live object to copy it.

### Static gates re-measured at the candidate working tree

| Gate | Result |
|---|---|
| Broad census | **58 failed / 1540 passed**, every RED absent-script — baseline restored |
| Regression hunt | **NONE** outside `test_scripts_inert.py` / `test_surface_contract.py` |
| Lint | `uv run --frozen ruff check src tests` — **exactly 12**, no new error; `preparation.py` ISC004 anchors drift `650,684` → `662,696` (**F91 recurring a fourth time**) |
| Compile | `compileall -q src tests` clean, exit 0 |
| Size | `preparation.py` **799** of a strict `< 800` — the candidate first measured **805**, a real size-control breach caught by `test_no_authored_module_exceeds_the_reviewed_size_bound`; corrected by trimming comment prose only, no control touched |
| Diff-check | `git diff --check` clean; `git status --short` exactly the three modified files plus the untracked `uv.lock`, unmodified |

The 805-line breach is worth recording on its own: the size bound is enforced by a test, and it
caught a real violation that the census's absent-script noise would otherwise have hidden at
**59 failed**. Any future repair to `preparation.py` has **one** free line.

### Push gate at this working tree

**P0 = 0. P1 OPEN = 4** — F33 (deferred to the GREEN); F87 (**defect stands**, its candidate repair
now refuted by measurement); F103; and **F104**. **P1 repaired-unreviewed = 4** (F78, F85, F83, F86).
**P2 = 29.** **P3 = 33.** The gate `P0 = P1 = P2 = 0` is **not met**. The atomic entrypoint GREEN
stays blocked. **None of the 90-commit local range is push-eligible.** Origin/PR #55 remains at
`73ec822`, OPEN, draft, `CLEAN`, four rendered hosted checks SUCCESS. RUNTIME remains **HOLD**.
PRODUCTION remains **Founder-only**.


## Cycle 47 — F87's real repair: binding the dead copy to the validated read

Heading numbering follows F101 (**P3, OPEN**): the `## Cycle` headings in this file are not in
monotonic order and this heading does not assert one.

### Baseline re-measured at the candidate working tree, independently of the repair lane

Local HEAD `cff1fb2476be5082debeccbc39018bf425b12ed7`; branch `codex/uat-browser-g-u2b-db-red-gate-r1`,
92 commits ahead of origin. Working tree carries the three-file uncommitted F104 candidate plus the
preserved untracked `uv.lock`, unmodified.

| Gate | Result |
|---|---|
| Broad census | **58 failed / 1540 passed** |
| RED classification | **all 58 absent-script**: 51 in `tests/test_scripts_inert.py`, 7 in `tests/test_surface_contract.py`, every one carrying `missing C8 implementation ... does not exist` |
| Unintended regressions | **zero** — no failure outside those two files |
| Lint | `uv run --frozen ruff check src tests` — **exactly 12**, the pinned baseline: `observe.py` F401 `:84,:85`, ISC004 `:266,:272,:281,:286,:345`; `preparation.py` F401 `:53`, ISC004 `:656,:690`; `tests/test_errors.py` I001 `:12`; `tests/test_runner.py` I001 `:3` |
| Compile | `compileall -q src tests` clean, exit 0 |
| Size | `preparation.py` **799**, `adapter.py` **799**, `views.py` **171**, all under the strict `< 800` bound |
| Diff-check | `git diff --check` clean |

The `preparation.py` ISC004 anchors read `656,690` here, against `662,696` recorded one cycle earlier
and `650,684` before that — **F91 recurring a fifth time**. The anchors are a function of line count,
not of any defect, and this file keeps recording them as if they were stable.

### F87's real repair — the dead copy bound to the validated read. **REPAIRED-UNREVIEWED.**

Two candidate repairs were refuted by measurement before this one (F103, F104). Both failed the same
way: they left the dead copy to be taken by a read *later* than the read that judged. F104 stated the
requirement exactly — *"one read, whose result is both judged and recorded"* — and that is what is
implemented here.

**Mechanism of the repair.** `__post_init__` used to spend three separate `.items()` reads on each
caller-supplied field: `immutability_findings` judged it, `stored_entries` reconciled it, and
`frozen` copied it. The pass that judged and the pass that copied were reading a live object free to
answer them differently. New `views.proved_copy(value, path)` fuses all three into one recursive
pass returning `(dead_copy, immutability_findings, divergence_findings)`. Per mapping there is
**exactly one** `.items()` read, taken by `stored_entries`, and the `stored` dict that read produced
is both what the live subscript is cross-checked against **and** what the returned copy is built
from — at every depth, keys as well as values, through `tuple` and `frozenset` members too. No later
read of the caller's object exists for a hostile mapping to answer.

**F103 is not repeated.** `stored_entries` is still called on the **live** object, before anything is
copied, so a `SubscriptRefuser` is still refused with `ValueError`. Freezing first — the F103
candidate — would have discarded the caller's `__getitem__` and rendered that cross-check vacuous.
Both pinned tests, `test_a_proved_result_refuses_an_unreadable_reading_as_a_value_error` and
`test_a_proved_result_refuses_an_unreadable_signed_identity_as_a_value_error`, pass.

**F104 is not repeated.** The freeze no longer spends a further read, so the budget-straddling attack
that defeated the previous candidate has no read to land on.

**The RED was strengthened before the GREEN.** F104 correctly refused the candidate's test as an
insufficient gate: it measured `spent` with an unreachable budget and then set `budget = spent`,
pinning only the stay-honest-throughout variant. That is replaced by a **budget sweep** — for every
budget in `range(1, spent + 1)`, with `image` and `granted_image_identity` budgeted **together**
(the variant F104 measured as the successful bypass, since flipping `image` alone is caught by
`signed_identity_findings`), the outcome must be either a `ValueError` refusal or a result whose
consumed image reference through `runner._attempt_names` is the honest one. The sweep is immune to
read-count drift, so it states the ordering defect itself rather than one arithmetic coincidence.

**Measured evidence at the repaired working tree.**

| Gate | Result |
|---|---|
| Broad census | **58 failed / 1542 passed** — the RED set is unchanged (51 `test_scripts_inert.py`, 7 `test_surface_contract.py`, all absent-script) and **two additional tests pass** |
| Unintended regressions | **zero** — no failure outside the two absent-script files |
| Lint | **exactly 12**, the pinned baseline, no new code |
| Compile | `compileall -q src tests` clean, exit 0 |
| Size | `preparation.py` **798** (one line *smaller* than before the repair), `views.py` **245**, both under the strict `< 800` bound |
| Diff-check | `git diff --check` clean |

`preparation.py` shrinking while the control strengthens is worth recording: the fusion removed a
pass rather than adding one, so the one free line the size bound left is not spent.

**Status.** F87 is **REPAIRED-UNREVIEWED**, not closed. F103 and F104 are repaired by the same
commit — each was a finding against a *candidate*, and neither candidate survives. Per F102, the
exact repair commit is recorded in this row at the moment it is written rather than in surrounding
prose. **An independent Opus verdict on this repair is owed and has not been obtained.** No
`P1 -> 0` claim may be made until it is.

### Push gate at this working tree

**P0 = 0. P1 OPEN = 1** — F33 alone, deferred to the atomic entrypoint GREEN. **P1
repaired-unreviewed = 7** (F78, F85, F83, F86, and now F87, F103, F104). **P2 = 29. P3 = 33.** The
gate `P0 = P1 = P2 = 0` is **not met** and is not met by a repair that has not been reviewed. The
atomic entrypoint GREEN stays blocked. **None of the local range is push-eligible.** Origin/PR #55
remains at `73ec822`, OPEN, draft, `CLEAN`, four rendered hosted checks SUCCESS. RUNTIME remains
**HOLD**. PRODUCTION remains **Founder-only**.

## Cycle 48 — the F87 repair's independent review, and the gates it was reviewed against

Heading numbering follows F101 (**P3, OPEN**): the `## Cycle` headings in this file are not in
monotonic order and this heading does not assert one.

### Live identity, re-read rather than carried forward

The checkpoint this cycle opened from named local HEAD `76553f4` and "11 commits ahead of origin".
Live git says otherwise and live git is authoritative: local HEAD is
`31d4d59f355decf27b747e66d83072bf15ba4862`, branch `codex/uat-browser-g-u2b-db-red-gate-r1`,
**93 commits ahead** of origin. The working tree carries no modified tracked file — the F87 repair
that the previous cycle left uncommitted is now commit `31d4d59` — and the untracked
`integration/topology-rehearsal/uv.lock` is preserved, unmodified. Origin/PR #55 remains at
`73ec822`, OPEN, draft, `CLEAN`, with all four rendered hosted checks SUCCESS (two `secret-scan`,
two `contract standards validation`, workflow `contracts`).

### Static gates re-measured at live HEAD `31d4d59`, by a lane that did not write the repair

| Gate | Result |
|---|---|
| Broad census | **58 failed / 1542 passed** |
| RED classification | **all 58 absent-script**: 51 in `tests/test_scripts_inert.py`, 7 in `tests/test_surface_contract.py`, every one carrying `missing C8 implementation ... does not exist` |
| Unintended regressions | **zero** — no failure outside those two files |
| Lint | `uv run --frozen ruff check src tests` — **exactly 12**, every code and file matching the pinned baseline |
| Compile | `uv run --frozen python -m compileall -q src tests` clean, exit 0 |
| Size | all 12 authored modules under the strict `< 800`; `adapter.py` **799** (zero headroom), `preparation.py` **798**, `views.py` **246** |
| Diff-check | `git diff --check` clean; `git status --short` shows only the untracked `uv.lock` |

The census figure the repair commit `31d4d59` claims in its own message — 58 failed / 1542 passed,
every RED absent-script, zero regressions, lint 12, compile clean — is **confirmed by independent
measurement at HEAD**, not merely restated.

Two claims in that commit message are **false in detail, and are recorded here rather than left to
be inherited**:

1. `preparation.py` is 798, as claimed — but `views.py` measures **246**, not the claimed 245.
   Both remain under the bound; the claim is wrong by one line. **Opened as F105 below.**
2. The two `preparation.py` ISC004 lint anchors now measure **`:655` and `:689`**, against the
   `:656` / `:690` this file pinned one cycle earlier and `:662` / `:696` the cycle before that.
   The lint *count* (12), codes and files are unchanged; only the anchors moved, because the
   repair shortened the file. This is **F91 recurring a sixth time**, and it is now the single
   most-repeated defect class in this ledger.

### F105 — **P3** — `docs/REVIEW-LEDGER.md` cycle 47, and commit `31d4d59`'s message. **NEW, OPEN.**

Both state `views.py` at **245** lines. Measured at live HEAD it is **246**. The failure scenario is
not a control breach — the file is 553 lines under the bound — but this ledger's size table is the
only evidence the `< 800` control is not being approached silently, and a size table that is wrong
by one line on the file the cycle actually created is a table that was transcribed rather than
measured. Repair is to re-measure at write time, not to edit the number.

## Cycle 49 — the F87 repair's independent verdict, obtained and recorded

Heading numbering follows F101 (**P3, OPEN**): the `## Cycle` headings in this file are not in
monotonic order and this heading does not assert one.

### Why this cycle exists

Cycle 48's heading claims to be about "the F87 repair's independent review". Its section
re-measured the static gates and opened F105, and then **stopped — it records no verdict**. The
cycle timed out before one was obtained. So F87, F103 and F104 stood as **repaired-unreviewed**
alongside F78, F85, F83 and F86, and the atomic entrypoint GREEN stayed blocked on a review that
had been commissioned twice and recorded zero times. Obtaining and durably recording that verdict
is this cycle's whole outcome.

### Live identity, re-read rather than carried forward

The checkpoint this cycle opened from named local HEAD `76553f4` and "11 commits ahead". Live git
is authoritative and says otherwise: HEAD is
`5fb163fcaf7f80894e840adc00635ed00a709b0d`, branch `codex/uat-browser-g-u2b-db-red-gate-r1`,
**94 commits ahead** of origin. No tracked file is modified; the untracked
`integration/topology-rehearsal/uv.lock` is preserved unmodified. Origin/PR #55 remains at
`73ec822`, **OPEN, draft, `CLEAN`**, four rendered hosted checks SUCCESS (two `secret-scan`, two
`contract standards validation`, workflow `contracts`).

### Static gates measured at live HEAD `5fb163f`, by a lane that wrote none of this code

| Gate | Result |
|---|---|
| Broad census | **58 failed / 1542 passed** |
| RED classification | **all 58 absent-script**: 51 in `tests/test_scripts_inert.py`, 7 in `tests/test_surface_contract.py`, every one raised at `tests/conftest.py:94` carrying `missing C8 implementation — ... does not exist` |
| Unintended regressions | **zero** — no failure outside those two files, and no failure lacking the marker |
| Lint | `uv run --frozen ruff check src tests` — **exactly 12**, every code and anchor matching the pinned baseline (2 `F401` + 5 `ISC004` in `observe.py`; 1 `F401` + 2 `ISC004` at `preparation.py:53,655,689`; 2 `I001` in `tests/`) |
| Compile | `uv run --frozen python -m compileall -q src tests` clean, exit 0 |
| Size | all 12 authored modules under the strict `< 800`; `adapter.py` **799**, `preparation.py` **798**, `grant.py` **794**, `views.py` **246** |
| Diff-check | `git diff --check` exit 0; `git status --short` shows only the untracked `uv.lock` |

**F105 is re-confirmed by measurement, not inherited.** `views.py` measures **246** at live HEAD.
Commit `31d4d59`'s message and cycle 47 both state **245**. The finding stands as written.

The `preparation.py` `ISC004` anchors measure `:655` and `:689`, unchanged from cycle 48 — F91 did
not recur this cycle, because no source line moved.

### The independent verdict was commissioned and did not return inside the timebox

Three independent lanes were commissioned against commit `31d4d59` at live HEAD: a full independent
GO/NO-GO review of the repair in its module context, an adversarial verifier tasked to *refute* it by
building and running executable hostile mappings, and a ledger cross-check of the seven
repaired-unreviewed P1s against live source. **None returned before this cycle's timebox expired.**

**No verdict is claimed here.** This section is written so the next cycle cannot mistake a
commissioned review for an obtained one — the precise error cycle 48 made, whose heading announced
a review it never recorded. F87, F103, F104, F78, F85, F83 and F86 remain **repaired-unreviewed**.

The coordinator's own reading of the repair is recorded as *unreviewed analysis, not a verdict*, so
the next reviewer has a starting point rather than a conclusion to ratify:

- `proved_copy` (`views.py:189`) takes exactly one `.items()` read per mapping, via
  `stored_entries` (`views.py:134`, `stored = dict(mapping.items())`), and the `stored` dict that
  read produced is both what the subscript is cross-checked against (`views.py:136-170`) and what
  the copy is built from (`views.py:227-235`). On the direct-construction path this appears to be
  the single-read property F87 demanded.
- **An open question the next reviewer must settle, not assume:** on the `prepare()` ingress path
  the caller's mapping is already reduced to a dead copy by `frozen()` (`preparation.py:129-152`,
  `737-758`) *before* `PreparationResult` is constructed. `frozen()` reads `.items()` once and
  performs **no** subscript cross-check. So `proved_copy`'s divergence check at
  `preparation.py:221` reconciles a dead copy with itself on that path and can refuse nothing —
  structurally the same vacuity F103 named, relocated to ingress. Whether this is a bypass or
  merely an inconsistency turns on whether any consumer subscripts the caller's live object rather
  than the recorded copy. **This is unmeasured and must be measured, not argued.**
- The accompanying RED (`tests/test_preparation.py`, `ReadBudgetMapping` and `sweep_every_budget`)
  budgets `.items()`, `__iter__`, `__getitem__` and `.get` **together** and sweeps every budget up
  to what validation spends, so it states the ordering defect rather than one read count. It is not
  a strawman.

**Status carried forward unchanged: P0 = 0. P1 OPEN = 1** (F33, deferred to the atomic entrypoint
GREEN). **P1 repaired-unreviewed = 7. P2 = 29. P3 = 34** (F105). **No part of the 95-commit local
range is push-eligible**, because push requires an independent P0=P1=P2=0 verdict that does not yet
exist. RUNTIME remains **HOLD**.

### The ledger cross-check lane returned after the timebox, and its evidence is recorded here

This lane was commissioned in this cycle and returned late. Its results are transcribed rather than
discarded. It verified every claim against live source, not against this file's prose.

**All seven repaired-unreviewed P1s are genuinely present in live source.** Each was opened at the
anchor the ledger names and the described mechanism was found:

| Finding | Live status | Anchor |
|---|---|---|
| F78 | PRESENT, anchor exact | `observe.py:263` stored read, subscript cross-check `:276-288` |
| F85 | PRESENT, anchor exact | `observe.py:339` `stored_entries`; the `.get` at `:357,:361` now reads the dead copy |
| F83 | PRESENT, **anchor stale** | mechanism at `preparation.py:251-268`, not the `:233` this file names |
| F86 | PRESENT, **anchor stale** | same site, `read_entries.get(OBSERVED_AT_KEY)` at `:268` |
| F87 | PRESENT | `preparation.py:217-223` over `views.py:189-244` and `:95-171` |
| F103 | defect **absent** from live source | the pre-freeze reconciliation runs on the live object at `views.py:134-171` |
| F104 | defect **absent** from live source | one `.items()` read per mapping; copy built from it at `views.py:227-237` |

F103 and F104 are more precisely **superseded than patched** — each was a finding against a
*candidate* whose code path does not exist in the committed mechanism. Recording them as "repaired"
is accurate in effect but imprecise in kind.

**This does not discharge the independent verdict.** Confirming that a repair is present is not
confirming that it is correct. The refutation lane and the full GO/NO-GO lane are still owed.

### F106 — **P3** — `docs/REVIEW-LEDGER.md`, findings F83 and F86. **NEW, OPEN.**

Both anchor their root cause at `preparation.py:233`. That line today is an unrelated
`ephemeral_range` refusal; the repaired site is `preparation.py:251-268`. The mechanism is present,
so this is not a control breach — but an anchor that points at unrelated code is an anchor that
cannot be audited, and a future reviewer following it would read the wrong refusal and conclude the
repair is missing. **This is F91 recurring a seventh time**, now the most-repeated defect class in
this ledger by a clear margin. Repair is to re-derive anchors at write time.

### F107 — **P2** — `docs/REVIEW-LEDGER.md:1611` and `:1858`, finding F16. **NEW, OPEN.**

F16's severity is stated as **P3** in the band-1 register at `:1611` and as **P2** at `:1858`
("CONFIRMED, counts re-measured"). The two were never reconciled. This is a P2 rather than a P3
because the push gate is stated in terms of P2 = 0: if F16 is a P2, the P2 count is wrong wherever
it was taken from the P3 reading, and a gate computed from that count is computed from a number the
document contradicts elsewhere. Repair is to adjudicate F16's severity once and restate it in both
places.

### The push-gate block was never restated after F105

Cycle 48 opened F105 as a new P3 and then ended without restating the `P0/P1/P2/P3` block, so this
file's most recent *stated* status said `P3 = 33` while its own last addition made it 34. No reader
could get the right number without recomputing it. **This cycle states it: P3 = 34** (and P3 = 35
once F106 is counted, P2 = 30 once F107 is). The lane also re-confirmed that `F56`–`F59` remain
phantom slots never assigned to anything, exactly as F99 records, so the true defined-ID count is
**104**, not the 108 that F1..F105 plus F29-A/B/C would suggest.

### F33 and the spec's owed paths are accurate and current

F33 requires `attempt_id_for` to be an exported seam called by both `runner._attempt_names` and the
future composition root. Live source confirms it: `runner.py:81` exports it, `runner.py:286-307`
defines it, and `runner.py:331` is its sole existing caller. `scripts/` does not exist, so the
second caller genuinely cannot exist yet — **F33's "deferred to the entrypoint GREEN" status is
correct, not an excuse**. `docs/ENTRYPOINT-SLICE-SPEC.md:525-563` names exactly six owed paths (the
two entrypoint scripts, `__init__.py`, `tests/test_surface_contract.py`, `pyproject.toml`, and
`tests/conftest.py` only if `PROJECT_STATUS` is retired), agreeing with the ledger. **No spec/ledger
drift on the owed set.**

## Cycle 50 — the F87 repair proved complete in `views.py` and proved incomplete one frame up

Measured at live HEAD `45c82710e0ca8bebdec9f090b90b8698bcde61fe`, branch
`codex/uat-browser-g-u2b-db-red-gate-r1`, 97 commits ahead of origin. Origin/PR #55 remains at
`73ec822`, **OPEN, draft, `CLEAN`**, four rendered hosted checks SUCCESS (two `secret-scan`, two
`contract standards validation`). Working tree carries only the untracked
`integration/topology-rehearsal/uv.lock`, preserved untouched.

### Gates re-measured at this HEAD

- Broad static census: **`58 failed, 1542 passed in 0.85s`**.
- Census classified **by traceback, not by test name**: **58 ABSENT-SCRIPT, 0 UNINTENDED**. Every
  one of the 58 terminates in the same `conftest.py:94` `pytest.Failed: missing C8 implementation`,
  split `scripts/` the directory ×1, `scripts/prepare_topology_grant.py` ×8,
  `scripts/run_topology_rehearsal.py` ×49 = 58. By file: `tests/test_scripts_inert.py` 51,
  `tests/test_surface_contract.py` 7. `scripts/` does not exist.
- Focused adapter/runner/admission/preparation/plan/observe suites: **1144 passed**.
- `git diff --check 73ec822..HEAD`: clean.
- `python3 -m compileall -q src tests`: exit 0, no output.
- `ruff check .`: **12 errors**, all pre-existing and none inside the range's new logic — F401 ×3
  (`observe.py:84`, `observe.py:85`, `preparation.py:53`), ISC004 ×7 (`observe.py:266,272,281,286,345`;
  `preparation.py:655,689`), I001 ×2 (`tests/test_errors.py:12`, `tests/test_runner.py:3`).
- Size bound: **no file over 800**. `adapter.py` 799, `preparation.py` 798, `grant.py` 794,
  `runner.py` 756, `admission.py` 725, `observe.py` 693, `plan.py` 533, `protocols.py` 382,
  `constants.py` 264, `views.py` 246, `errors.py` 159, `__init__.py` 11. Total 6160.
- F33's seam re-confirmed live: `runner.py:81` exports `attempt_id_for`, `runner.py:286` defines it,
  `runner.py:331` is its sole caller. The second caller is the absent composition root, so
  **"deferred to the atomic entrypoint GREEN" is accurate, not an excuse.**

### F108 — **P1** — `preparation.py:490-524`, `:737-757`, `:792-798`. **NEW, OPEN. Confirmed authority bypass, reproduced.**

An adversarial lane attacked `views.proved_copy` directly with twelve hostile `Mapping`
implementations — read-budget flips at every K from 0 to 11, mutually-disagreeing
`.items()`/`.keys()`/`.get()`/`__getitem__`, a refusing subscript, duplicate and injected keys, a
single-pass iterator `.items()`, a `str` subclass, an `__eq__` that claims equality with anything,
colliding hostile keys, a subscript that mutates as a side effect, and a nested mapping flipping at
depth. **`views.py` refused every one.** `proved_copy` spends exactly one `.items()` read per
mapping at every depth (`views.py:134`), builds the returned copy from that same `stored` dict
(`views.py:227-234`), and never stores a subscript result (`views.py:138` is cross-check only).
**The F87 repair is real and complete inside `PreparationResult.__post_init__`.**

**It is defeated by its own caller.** `preparation.py:792` `observed = observe(adapters)` hands
`prepare` the **live adapter objects**: `observe()` at `preparation.py:490-524` wraps each of the
eight observations in plain `guarded()` with no copy. `preparation.py:793-795` then validates those
live objects, and `preparation.py:737-757` calls `frozen(...)` on the *same live objects*, whose
`.items()` at `preparation.py:151` is a **second, unrelated read** — and it is that second read's
answer that becomes the record. `proved_copy` at `preparation.py:218` therefore runs on `frozen()`'s
already-dead output and reconciles a dead copy with itself: **exactly the F103 failure mode the
`views.py:201-203` docstring warns against, reintroduced one frame up.**

Reproduced, not argued. A `dict` subclass honest for 13 reads and hostile on read 14, passed as
`identities.observe_controls()`, yields `satisfied = True` with all four `control_identities`
recorded as attacker commit/tree and `clean: False`. No exception, no finding. The accepting call is
`preparation.py:798`. Two further straddles were confirmed on `docker.observe_platform()` at K=11
and K=12 (`preparation.py:740`, `:745` are two separate live reads); at K=12 the result is
self-contradictory, recording `engine_version 29.6.2` beside `docker_executable.version
0.0.0-attacker`. `host.observe_image()` **refused at every budget**, because
`signed_identity_findings` at `preparation.py:264` re-judges the dead copy against the grant-derived
pin — which is the shape the repair should take everywhere.

**No `MappingProxyType` trick is needed**: `frozen()` gates on `isinstance(value, Mapping)`
(`preparation.py:149`), so a bare `dict` subclass suffices. This is strictly wider than F87.

**Why the existing REDs missed it.** The F87 tests sweep read budgets against
`PreparationResult(**fields)` directly (`tests/test_preparation.py:1051-1120`) and never against
`prepare()`. The full suite is green through the bypass. **A green suite is not a proof of this
control.**

**Minimal fail-closed repair (specified, not yet applied).** Copy the eight observations dead **at
ingress**, as the authorization already is: replace `guarded(...)` with the existing `projected(...)`
for all eight calls in `observe()` (`preparation.py:490-524`). `projected` at `preparation.py:293-317`
already guards, freezes and refuses, and `frozen(None)` returns `None` (`preparation.py:131`, with
`type(None)` in `IMMUTABLE_LEAVES`), so the unresolved-observation findings are unaffected. The
hostile object is then read exactly once, before any decision, and all four straddles become
unreachable by construction. This must land **test-first**, with a RED that drives `prepare()` — not
`PreparationResult` — through a read-budget sweep.

### F109 — **P2** — `preparation.py:225`. **NEW, OPEN.**

`stored_entries` accepts keys that `.items()` invents where `__getitem__` corroborates them —
harmless in `views.py`, but `__post_init__` re-checks the key set only for `control_identities`.
`docker_platform`, `docker_executable`, `probe_executable` and `selected_image_identity` have no
key-set gate, so an injected extra key survives into a satisfied result.

### F110 — **P2** — `observe.py:462-463`. **NEW, OPEN.**

The live container projection is read twice through `views.nested`, which resolves by `.get()`
(`views.py:49`) — the third protocol nothing in this package reconciles, and the same accessor F86
and F85 were opened against. Same defect class, different seam.

### F111 — **P3** — `docs/REVIEW-LEDGER.md:5749-5750`. **NEW, OPEN.**

The claim that "the true defined-ID count is **104**" was stale when written. It computes
`F1..F105 − 4 phantom + 3 sub-IDs = 104`, but F106 (`:5725`) and F107 (`:5734`) were opened *earlier
in the same cycle-49 section*. The same method through F1..F107 gives **106**. The very next
sentence folds F106/F107 into the P2/P3 counts and forgets them two clauses earlier.

### F112 — **P3** — `docs/REVIEW-LEDGER.md:5563-5564`, `:5695-5698` against `:5709-5720`. **NEW, OPEN.**

F103 and F104 are counted as "repaired-unreviewed" while the same cycle's own cross-check states
their defects are absent from live source and that they are "more precisely superseded than
patched." The arithmetic is self-consistent but rests on a classification this file flags as
imprecise. Adjudicate once and restate in both places.

### The independent cross-check of this file's own arithmetic

An independent lane re-derived every total from the body rather than from any summary. **Every
stated total in the cycle-49 push-gate block reconciles exactly**: P0 = 0 (the `:382` "P0" row
predates F-numbering and is pre-DISCHARGED, not a live ID); P1 OPEN = 1 (F33); P1
repaired-unreviewed = 7 (F78, F85, F83, F86, F87, F103, F104); P2 = 30; P3 = 35; closed 26;
superseded 2; phantom 4. Full reconciliation: 26 + 2 + 4 + 1 + 7 + 30 + 3 (P2 repaired-unreviewed
F79, F84, F95) + 35 + 2 (P3 repaired-unreviewed F96, F97) = **110 slots** = F1..F107 plus F29-A/B/C.
**F56–F59 are re-confirmed phantom**: no `### F56`–`### F59` heading, table row or subject line
exists anywhere; every mention is a sentence *about* the gap. **No register-only IDs.** F111 is the
only arithmetic defect found.

**F106 is ACCURATE against live source.** `preparation.py:233` today is the unrelated
`ephemeral_range` refusal; the repaired site is `preparation.py:251-268`, where `stored_entries`
reconciles `granted_image_identity` and `image` and where the `.get(OBSERVED_AT_KEY)` calls sit
(`:259`, `:268`). F83's and F86's anchors are stale exactly as F106 claims.

**F107 is ACCURATE.** `:1611` states `| F16 | P3 | ... |` and `:1858` states `| F16 | P2 | ... |`
for the same ID, never reconciled at either site.

**No spec/ledger drift.** `docs/ENTRYPOINT-SLICE-SPEC.md:525-563` names exactly the six owed paths —
the two entrypoint scripts, `__init__.py`, `tests/test_surface_contract.py`, `pyproject.toml`, and
`tests/conftest.py` conditionally on `PROJECT_STATUS` being retired — matching this file exactly,
including the conditional framing.

### Push gate at the end of cycle 50

**P0 = 0. P1 OPEN = 2** — F33 (deferred to the atomic entrypoint GREEN) and **F108 (a confirmed,
reproduced authority bypass)**. **P1 repaired-unreviewed = 7** (F78, F85, F83, F86, F87, F103, F104).
**P2 = 32** (F109, F110 added). **P3 = 37** (F111, F112 added). Defined-ID count is now **111**
(F1..F112 minus the four phantoms, plus F29-A/B/C).

**No part of the 97-commit local range is push-eligible.** F108 is a P1, so the P0=P1=P2=0 gate
fails on measurement, not on a missing review. **The atomic entrypoint GREEN must not begin**: it
would build a composition root on top of a `prepare()` whose satisfied result can carry attacker
content. RUNTIME remains **HOLD**. Production remains **Founder-only**.

Heading numbering follows F101 (**P3, OPEN**): the `## Cycle` headings in this file are not in
one-to-one correspondence with driver cycle indices.

## Cycle 51 — every static gate re-measured at a new HEAD, and F108's blind spot proved from source

Measured at live HEAD `f1421292bd877848abfb8e3224e3311a8e0ad421`, branch
`codex/uat-browser-g-u2b-db-red-gate-r1`, **98 commits ahead of origin**. Origin/PR #55 remains at
`73ec822e02383b38d7fe61be4f646304f297ea18`, **OPEN, draft, `MERGEABLE`**, four rendered hosted checks
SUCCESS (two `secret-scan`, two `contract standards validation`, workflow `contracts`). The working
tree carries only the untracked `integration/topology-rehearsal/uv.lock`, preserved untouched and
byte-identical.

### Gates re-measured at this HEAD, not carried forward

- Broad static census: **`58 failed, 1542 passed in 0.77s`** — unchanged from cycle 50 across the one
  intervening commit `f142129`.
- Census classified by traceback terminus, re-run rather than quoted: **58 of 58 terminate in
  `missing C8 implementation`**, i.e. **58 ABSENT-SCRIPT, 0 UNINTENDED**. By file:
  `tests/test_scripts_inert.py` 51, `tests/test_surface_contract.py` 7. `scripts/` does not exist.
- `git diff --check 73ec822..HEAD`: clean.
- `python3 -m compileall -q src tests`: exit 0, no output.
- `ruff check .`: **12 errors**, exactly the pinned pre-existing baseline; no delta.
- Size bound: **no file over 800**. `adapter.py` 799, `preparation.py` 798, `grant.py` 794,
  `runner.py` 756, `admission.py` 725, `observe.py` 693, `plan.py` 533, `protocols.py` 382,
  `constants.py` 264, `views.py` 246, `errors.py` 159, `__init__.py` 11. Total **6160**.
  **`preparation.py` has two lines of headroom**, which constrains any F108 repair landing there:
  the repair must not grow the file, and no control may be deleted to make room.

### F108's blind-spot claim is confirmed from source, independently of the reproduction

Cycle 50 asserted that the existing F87 read-budget sweeps missed F108 because they drive
`PreparationResult` rather than `prepare()`. That is now verified by reading the test source rather
than by trusting the claim. `tests/test_preparation.py:1078-1092` defines `build_with_budgets`, which
constructs `result_type(**fields)` directly; `sweep_every_budget` at `:1101` consumes only that
constructor. `tests/test_preparation.py` names `prepare(` 46 times, and **none of those call sites is
inside a read-budget sweep** — every budgeted construction goes through `build_with_budgets`. The
control that F87 installed is therefore exercised only at the `PreparationResult` boundary, one frame
below the `observe()`/`snapshot()` straddle F108 reproduces. **The green suite is confirmed to be
green through the bypass**, and that is a property of the tests, not an accident of the run.

### Push gate at the end of cycle 51 — unchanged, and unchanged for a measured reason

**P0 = 0. P1 OPEN = 2** — F33 (deferred to the atomic entrypoint GREEN) and **F108 (a confirmed,
reproduced authority bypass, still unrepaired at this HEAD: `observe()` at
`preparation.py:490-524` still wraps all eight observations in `guarded(...)`)**. **P1
repaired-unreviewed = 7** (F78, F85, F83, F86, F87, F103, F104). **P2 = 32. P3 = 37.** Defined-ID
count **111**.

**No part of the 98-commit local range is push-eligible.** The P0=P1=P2=0 gate fails on measurement.
**The atomic entrypoint GREEN must not begin** while F108 stands. RUNTIME remains **HOLD**.
Production remains **Founder-only**.

### The F108 repair was applied in-tree this cycle, measured, and is NOT yet committable

The specified minimal repair was applied to the working tree (uncommitted, preserved): all eight
`guarded(...)` calls in `observe()` (`preparation.py:490-524`) became `projected(...)`. Inspected
directly as a diff, that change is **exactly the specified repair and nothing else** — eight
insertions, eight deletions, no control, refusal, guard or docstring removed — and at that point
`preparation.py` was still **798** lines, i.e. line-neutral, as `projected` and `guarded` are the
same length.

**Measured with the repair applied**, at the working tree over HEAD `9ccd92a`:

- Full suite: **`59 failed, 1544 passed`**. `1544 = 1542 + 2` new tests.
- Terminus classification: **58 of the 59 terminate in `missing C8 implementation`**. There is
  therefore **exactly one UNINTENDED failure** — the first non-absent-script failure this range has
  produced.
- `ruff check .`: 12 errors, **no delta** against the pinned baseline.
- `python3 -m compileall -q src tests`: exit 0.

### F113 — **P1** — `preparation.py`, working tree only. **NEW, OPEN. Blocking, measured.**

The single unintended failure is
`tests/test_surface_contract.py::test_no_authored_module_exceeds_the_reviewed_size_bound`:

    AssertionError: assert {'src/cybrik_suite_topology_rehearsal/preparation.py': 803} == {}

`MODULE_LINE_LIMIT` is **800** (`tests/test_surface_contract.py:96`). `preparation.py` reached **803**
through **five net lines added after** the eight-swap minimal repair (the file diff grew from 8/8 to
14 insertions / 9 deletions). This is a **reviewed size control failing closed exactly as designed**,
and it is recorded as a P1 because the range's own control test is RED on non-absent-script grounds
for the first time.

**It must not be discharged by raising `MODULE_LINE_LIMIT`, by deleting a control, or by extracting a
module.** Extraction is a separate reviewed change and is not authorized in this cycle. The repair is
to revert the five lines that are not load-bearing for the F108 fix, returning the file to 798.

**The F108 repair is therefore measured-but-not-committed.** Its RED-before-GREEN proof — the exact
failing output showing attacker content recorded with `satisfied=True` through `prepare()` — was
commissioned and has **not been received**, so this repair is **not yet recordable as TDD** and the
two new tests are of unproved RED provenance. F108 stays **OPEN**.

**Push gate unchanged: P0 = 0, P1 OPEN = 3** (F33, F108, F113). RUNTIME **HOLD**. Production
**Founder-only**.

## Cycle 51 continued — F108 repaired test-first, F113 closed, and the repair still unreviewed

### F113 is CLOSED by measurement

The size breach was transient. It came from an expanded `observe()` docstring added on top of the
eight swaps; that docstring was reverted to one line before the file was committed. `preparation.py`
is **798** lines and `test_no_authored_module_exceeds_the_reviewed_size_bound` **passes**. No
`MODULE_LINE_LIMIT` was raised and no control was deleted to achieve it — verified by reading the
committed diff, which is 9 insertions / 9 deletions on that file: the eight `guarded` -> `projected`
swaps plus one line-neutral docstring correction, and nothing else.

### F108's RED was proved independently by the coordinator, not accepted on report

The writer's RED-before-GREEN claim was **not** taken on trust. The coordinator reproduced it
directly: `preparation.py` was reversibly replaced with its committed pre-repair content, the new
test was run, and the file was restored and diffed byte-identical afterwards. Exact pre-repair
output:

    AssertionError: budget 10: platform answered every read the findings spent honestly and turned
    hostile afterwards, and a satisfied preparation recorded
    ["docker_platform['engine_version'] = '0.0.0-attacker'",
     "docker_executable['version'] = '0.0.0-attacker'"]
    FAILED ...[observe_controls]
    FAILED ...[observe_platform]
    2 failed, 1 passed

**The RED fails for exactly the right reason.** `assert result.satisfied is True` passes first; it is
`assert recorded == ()` that fires. A *satisfied* preparation recorded attacker content. The writer
independently measured the same shape one budget earlier for controls (K=9, all four control
repositories carrying attacker commit and tree). **`observe_image` passed at every budget both times**,
confirming from two independent measurements the cycle-50 claim that `signed_identity_findings`
re-judges the dead copy against the grant-derived pin and is the shape the repair should take.

### The repair, committed at `f40c5a9`

All eight observations in `observe()` (`preparation.py:490-524`) are taken through `projected(...)`,
which guards and then `frozen(...)`s at ingress. The hostile object is now read exactly once, before
any decision, so the reading that validation judges and the reading that `snapshot()` records are one
reading. Every straddle F108 reproduced is unreachable by construction.

### Gates measured on the committed tree

- New RED, now GREEN: **3 passed** (`observe_controls`, `observe_image`, `observe_platform`).
- Focused adapter/runner/admission/preparation/plan/observe suites: **1147 passed**.
- Full suite: **`58 failed, 1545 passed`** — back to the absent-script baseline, **58/58 terminating
  in `missing C8 implementation`, 0 UNINTENDED**. `1545 = 1542 + 3` new tests.
- `ruff check .`: 12 errors, **delta 0** against the pinned baseline.
- `python3 -m compileall -q src tests`: exit 0. Size bound: max 799 (`adapter.py`), total 6160.

### An independent blast-radius survey found no existing test flips

A separate read-only lane enumerated every seam the swap could disturb — refusal-message shape,
refusal ordering between `observation_findings` and a copy failure, identity-vs-equality passthrough,
field types, `src/` consumers of `observed.<field>`, and whether `frozen()` at ingress could refuse a
shape a *passing* test relies on. **Zero existing tests flip**, confirmed both from source and by
running 863 tests against the swapped `observe()`. It recorded one latent, currently-unexercised
consequence: a future test feeding `passing_adapters` a value `frozen()` cannot copy will now refuse
at ingress with a `"while being copied"` message rather than later at `snapshot()`. That is a
behaviour change, not a control weakening, and nothing today exercises it.

### F108 is repaired-unreviewed, NOT closed

The commissioned adversarial sufficiency lane — the one asked to *refute* the claim that the swap
makes all straddles unreachable, and to hunt residual holes at `views.nested` (F110),
`stored_entries` key-set gating (F109), and the grant re-reads in `snapshot()` — **did not return
within the timebox**. A repair measured by its own author and its own RED is not an independent
verdict. **F108 moves from OPEN to repaired-unreviewed and must not be recorded as discharged.**

**Push gate: P0 = 0. P1 OPEN = 1** (F33, deferred to the atomic entrypoint GREEN). **P1
repaired-unreviewed = 8** (F78, F85, F83, F86, F87, F103, F104, **F108**). **P2 = 32. P3 = 37.**
F113 CLOSED. **No part of the 101-commit local range is push-eligible**: the P0=P1=P2=0 gate requires
an independent verdict that does not exist for F108. RUNTIME **HOLD**. Production **Founder-only**.

## Cycle 52 — the owed F108 verdict recommissioned; every gate re-measured at `b15a226` first

### The coordinator re-measured every gate itself before commissioning anything

The previous cycle's figures were taken at `f40c5a9`, one commit below live HEAD. They are not
evidence about `b15a226`. Re-measured directly at live HEAD `b15a226`, from the package root:

| Gate | Cycle-51 claim (at `f40c5a9`) | Measured at `b15a226` | Result |
|---|---|---|---|
| Full suite | 58 failed, 1545 passed | **58 failed, 1545 passed** | MATCH |
| RED reason | 58/58 `missing C8 implementation` | **58** matched, 0 UNINTENDED | MATCH |
| `ruff check .` | 12 errors, delta 0 | **12 errors**, delta 0 vs pinned baseline | MATCH |
| `python3 -m compileall -q src tests` | exit 0 | **exit 0** | MATCH |
| Largest authored module | 799 (`adapter.py`) | **799** (`adapter.py`); `preparation.py` **798** | MATCH |
| `git diff --check 73ec822..HEAD` | not previously recorded | **clean** | NEW |

The 58 REDs were additionally proved absent-*root*, not merely absent-script: `scripts/` does not
exist at HEAD (`ls: scripts/: No such file or directory`). No entrypoint script was run, and none
exists to run.

### The F108 repair diff was verified from the commit, not from its author's description

`git show f40c5a9` touches exactly two files. On `preparation.py` it is 9 insertions / 9 deletions:
**eight** `guarded(` -> `projected(` swaps (`controls`, `image`, `ephemeral_range`, `listeners`,
`platform`, `docker_digest`, `publications`, `probe_digest`) plus one line-neutral docstring
correction. **No guard was deleted, no exception clause widened, no `MODULE_LINE_LIMIT` raised.**
`projected()` (`preparation.py:293-316`) reads once through `guarded()` and then `frozen()`s, and
`frozen()` (`:129-`) recursively dead-copies mappings to `MappingProxyType` and sequences to tuples,
refusing cycles, unknown types and safe-scalar subclasses. The structure matches the claim; whether
it is *sufficient* is exactly what the independent lane must decide, and the coordinator does not
pre-judge it here.

### F108's owed verdict is recommissioned, not assumed

The lane that failed to return within cycle 51's timebox has been re-commissioned this cycle as an
explicitly adversarial reviewer instructed to *refute* the unreachability claim and to default to
"not proved" under uncertainty, with F109 (`stored_entries` key-set gating) and F110
(`views.nested`) named as specific hunting grounds. **Until it returns, F108 remains
repaired-unreviewed. The push gate is unchanged.**

### The evidence cross-check returned CLEAN — the first fully clean audit of this ledger

An independent read-only lane re-derived every factual claim in the cycle-51-continued section and
the push-gate tally from live source and live measurement. **Every claim matched. No new
discrepancy was found.** It reproduced, independently of the coordinator: the 3-passed RED-now-GREEN
set, **1147 passed** across the six focused suites, the 58/1545 census with all 58 tracebacks
inspected (not merely grepped) and reducing to the absent-script message, the 12 ruff errors at the
exact pinned sites, `compileall` exit 0, max module 799 and total 6160, and `f40c5a9`'s 9/9 numstat
with `preparation.py` at 798 lines and the size test passing.

It also **re-derived the push-gate tally from scratch**, tracing every status-changing `### F<n>`
heading forward from the `9439bd0` register baseline through each OPEN/REPAIRED/CLOSED transition,
and independently recomputed **P1 OPEN = 1, P1 repaired-unreviewed = 8, P2 = 32, P3 = 37**. After
eleven cycles in which this ledger's own indices drifted from its own findings (F97, F98, F101,
F102), the tally is now independently reproduced rather than asserted.

Two pre-existing self-criticisms were reconfirmed as still-open and still-correct, and neither moves
the tally: **F112** (F103/F104 are bucketed *repaired-unreviewed* where *superseded* would be the
precise word) and **F107** (F16 is recorded P3 at `:1611` and P2 at `:1858`).

### What did NOT return this cycle

Both Opus lanes — the adversarial F108 sufficiency reviewer and the full-range independent reviewer
of `73ec822..HEAD` — were still running when the cycle timebox expired. **Neither verdict is
recorded, and neither may be assumed.** This is the second consecutive cycle in which the F108
sufficiency lane has failed to return inside a 600-second budget; the next cycle should commission
it as the *first* action rather than alongside other lanes, and should narrow it to the single
question of residual straddles at `views.nested` and `stored_entries`.

**Push gate at `0efcdaa`, unchanged: P0 = 0. P1 OPEN = 1** (F33). **P1 repaired-unreviewed = 8**
(F78, F85, F83, F86, F87, F103, F104, F108). **P2 = 32. P3 = 37.** No part of the local range is
push-eligible. RUNTIME **HOLD**. Production **Founder-only**.

## Cycle 53 — every gate re-measured at `9c1c4d2`, and the F108 verdict commissioned first

### The coordinator re-measured the gates before commissioning anything, again

Cycle 52's figures were taken at `b15a226`/`0efcdaa`. They are not evidence about live HEAD
`9c1c4d21bc0c307863822a329a9edb0dbc2d1dbd`. Re-measured at that HEAD by a lane that wrote nothing,
with the diff-check and size figures independently reproduced by the coordinator:

| Gate | Cycle-52 record | Measured at `9c1c4d2` | Result |
|---|---|---|---|
| Full suite | 58 failed, 1545 passed | **58 failed, 1545 passed** | MATCH |
| RED reason | 58/58 absent-script | **58/58**, 0 UNINTENDED | MATCH |
| Focused six suites | 1147 passed | **1147 passed** | MATCH |
| `ruff check .` | 12 errors, delta 0 | **12 errors**, same 12 sites, delta 0 | MATCH |
| `python3 -m compileall -q src tests` | exit 0 | **exit 0** | MATCH |
| Largest authored `src` module | 799 (`adapter.py`) | **799** (`adapter.py`); total **6160** | MATCH |
| `git diff --check 73ec822..HEAD` | clean | **clean** | MATCH |

The 58 REDs were again proved absent-*root*: `scripts/` does not exist at HEAD. The failures are
confined to `tests/test_scripts_inert.py` (52) and `tests/test_surface_contract.py` (6), and every
one of the 58 was classified from its own traceback rather than by grepping a count. **No entrypoint
script was run, and none exists to run.** The 12 ruff errors are the pinned baseline sites in
`observe.py`, `preparation.py`, `tests/test_errors.py` and `tests/test_runner.py`; none is new.

### The local range is 104 commits, not the 11 the stale checkpoint carried

Live HEAD is `9c1c4d2` and the branch is **104 commits ahead** of `origin`. The driver checkpoint
still named `76553f4` at 11 ahead. **Live git is authoritative**; the checkpoint prose was stale and
was not allowed to override it. Origin/PR #55 remains at `73ec822`, OPEN, **draft**, CLEAN, with all
four rendered hosted checks SUCCESS (two `secret-scan`, two `contract standards validation`).

### F33 reconfirmed OPEN from source by the coordinator

`attempt_id_for` is exported at `runner.py:81` and AST-pinned as the sole rendering site
(`tests/test_runner.py:1292-1294`). It has exactly **one** caller: `_attempt_names`
(`runner.py:310`), reached once at `runner.py:743`. The second caller is the entrypoint script that
does not exist. F33's "both callers reach it" therefore remains **false by absence**, and F33 stays
the single P1 OPEN, correctly deferred to the atomic entrypoint GREEN. It was not re-graded.

### F107 and F112 reconfirmed from source, and neither moves the tally

- **F107** is real: F16 is carried **P3** at `docs/REVIEW-LEDGER.md:1611` and **P2** at `:1858`. The
  same finding holds two severities in one ledger. Still **OPEN**.
- **F112** is real and precisely stated: `:5709-5720` already records that F103 and F104 are
  "**superseded** than patched — each was a finding against a *candidate* whose code path does not
  exist in the committed mechanism", while the push-gate tallies bucket them under
  *repaired-unreviewed*. Accurate in effect, imprecise in kind. Still **OPEN**.

### F108's owed verdict was commissioned as the first action of this cycle

Cycle 52 recorded that the F108 sufficiency lane had failed to return inside the timebox twice, and
directed that it be commissioned **first** and **narrowed**. That was done: it was launched as the
opening action, framed adversarially (instructed to *refute* the unreachability claim and to default
to "NOT PROVED" under uncertainty), and pointed at exactly the named hunting grounds — `views.nested`
(F110), `stored_entries` key-set gating (F109), the grant re-reads in `snapshot()`, any observation
in `observe()` outside the swapped eight, and whether `frozen()` passes any live type through by
identity. **Until that verdict is recorded here, F108 remains repaired-unreviewed.**

**Push gate at `9c1c4d2`, unchanged by measurement: P0 = 0. P1 OPEN = 1** (F33). **P1
repaired-unreviewed = 8** (F78, F85, F83, F86, F87, F103, F104, F108). **P2 = 32. P3 = 37.** No part
of the 104-commit local range is push-eligible. RUNTIME **HOLD**. Production **Founder-only**.

## Cycle 53 continued — three verdicts landed, F108 is answered, and a new P1 was proved

All three commissioned lanes returned after the nudge. **F108's owed verdict exists for the first
time in four cycles.** Every finding below was re-verified from live source by the coordinator
before being recorded; none is accepted on report.

### F108's verdict: the narrow claim survives, the universal clause is REFUTED

The adversarial lane was instructed to refute and to default to "NOT PROVED". It returned
**REFUTED** — but precisely, and the distinction matters:

- **What survived attack.** All eight `observe()` observations go through `projected()`; there is no
  ninth observation and no path into `prepare()` that bypasses `observe()`. `prepare()` also projects
  `expected_controls` and the grant once each (`preparation.py:775-781`). `snapshot()`'s re-reads
  (`:733-760`) land on `frozen()` dead copies, so the subscript is `dict.__getitem__`, never a hostile
  one — **no grant re-read reaches a live object.** `stored_entries` gating (`:225-273`) runs *after*
  the `proved_copy` loop at `:217-223`, so it reconciles the result against itself. `frozen()`
  (`:129-160`) passes through by identity only for exact `IMMUTABLE_LEAVES`; no container type this
  package uses survives it live. **F109 and F110 were both hunted and neither yielded a straddle in
  `prepare()`.**
- **What was refuted.** The cycle-51 wording "**every** straddle F108 reproduced is unreachable by
  construction" is too strong as written. It is true of the observation *content* in `prepare()`. It
  is false as a universal statement — see F114, which proves the same straddle class alive one layer
  up, in exactly the consumer the lane flagged as unreached.

**F108 is CLOSED** for the defect it filed: the eight-observation content straddle is independently
confirmed eliminated. Its overbroad sentence is corrected here rather than left standing. F108 leaves
the repaired-unreviewed bucket. **This closure does not extend past `prepare()`.**

### F114 — **P1** — `runner.py:399`, `:409`, `:419`. **NEW, OPEN. Proved straddle, post-creation.**

The post-creation network reading is judged from one read of a live port object and recorded from a
**second** read of the same live object. `network = adapters.docker.observe_network(...)`
(`runner.py:399`) is **not dead-copied at ingress**. It is judged by `validate_internal_network`
(`:409`), which reads through `projection.get(...)` (`observe.py:502`, `:507`); it is then recorded
by `network_projection=frozen(network)` (`:419`), which reads through `value.items()`
(`preparation.py:151`). A mapping that answers `.get()` and `.items()` differently is admitted as an
isolated network while the receipt records a non-isolated one. Measured:

    verdict.satisfied = True   findings = ()
    recorded = {'Internal': False, 'Containers': mappingproxy({'a': …, 'b': …, 'c': …})}

The `STOP_CONTROL` for a non-internal / multi-attachment network never fires, and the bundle records
the contradiction nobody judged. **This is not a strawman**: it is the exact hole `projected()` was
built to close, and `preparation.py:293-317`'s own docstring states the rule — "the value that is
checked and the value that is recorded are one value". The runner's post-creation path was never
given that treatment. "The adapter is trusted" is not available as a defence: `observe.py:6-9` states
that injected-port observations "arrive through injected ports, so their shape is never guaranteed".
**Repair shape: dead-copy at ingress in `_observe_attempt` before validation, judging and recording
the copy.** Not repaired in this cycle — it is a new P1 and needs its own RED first.

### F115 — **P2** — `adapter.py:293-296`. **NEW, OPEN.**

`observe_image` takes `projected[0]` from a decoded list without requiring exactly one entry. Where
two local images answer one reference, "which image is this" is decided by list order, and a
satisfied precheck can name the reviewed image while an unreviewed one also answers. `single_claim`
(`observe.py:377-382`) refuses `len != 1` for exactly this reason on publication views; this reader
does not. Confirmed at source.

### F116 — **P2** — `adapter.py:229-235`. **NEW, OPEN.**

`ExactCommandAdapter.__init__` calls `require_port("runner", runner, CommandRunner)` (`:233`) and
performs **no** structural check on `plan`. `CredentialFileAdapter` *does* `require_port("plan", plan,
TopologyPlan)` (`:546`), so the asymmetry shows the check was intended. A stand-in exposing a
`.commands` mapping of arbitrary argv passes construction, and `run_effect` (`:248-251`) then hands
that argv to the real runner. Single-spawn-site survives; **plan-membership becomes vacuous.**

### F117 — **P2** — `preparation.py:323`, `:326`, `:491-524`. **NEW, OPEN. Two lanes converged.**

`adapter_findings` isinstance-checks `getattr(adapters, name, None)` (`:326`) and re-reads it for the
message (`:323`); `observe()` then reads `adapters.identities`/`.host`/`.docker`/`.probe` again, once
per observation (`:491-524`). The port gate is **check-time only**. Measured by the adversarial lane:
a preparation returning `satisfied is True` in which **all eight** observations were served by objects
that are instances of none of the four reviewed ports. Damage is bounded — whatever is handed over is
still `projected()`-copied and judged — so this is an authority-gate defect, not a content straddle.
It is compounded by `runtime_checkable` Protocols (`protocols.py:216-312`) checking only member
presence. **Recorded P2, the higher of the two independent gradings** (the full-range lane graded the
same defect P3); the coordinator does not take the lower grade for a converged finding.

### F118 — **P3** — `adapter.py:671-683`, `runner.py:663-667`. **NEW, OPEN.**

If `fsync_directory` raises once `replaced=True`, `consume` re-raises and the runner reports
`attempt_consumed=False` with `PRECHECK_ABORT` while the durable budget is in fact spent. It fails in
the safe direction — budget burned, nothing created — but the **receipt misstates what happened**.

### F119 — **P3** — `docs/ENTRYPOINT-SLICE-SPEC.md`. **NEW, OPEN. Citation drift.**

The spec's citations through `:1202` land within 0-2 lines of the tests they describe. Beyond that
they are stale: `:1223-1280` now points into AST-guard helper code rather than the root-derivation
test (actually `tests/test_scripts_inert.py:1945-2031`); `:1304-1366` corresponds to
`:2056-2119`; `:817-832`/`:1369-1384` to `:2121-2137`. Cause: `a1a97f6`, `e3d6116`, `5bef003`,
`c56518f` inserted ~700 lines of module-wide root-derivation guard after `4230858`, the commit the
spec pins to. The spec disclaims this for `test_scripts_inert.py` ("where a citation and the file
disagree, the file wins", `:57`) but **not** for the front-door citations, which are independently off
by 1-2 (`:178-179` actual `180`; `:231` actual `232`). Separately, the spec attributes `PROJECT_STATUS`
to `tests/conftest.py`; it is defined at `tests/test_surface_contract.py:62`. **The contract substance
is stable** — argv shape, mapping accumulation, mandatory-keyword injection, single executor and the
withdrawn `.runner` publication all still match the live test bodies. Only the anchors drifted.

### The spec's owed-edit list is confirmed six paths, and none is applied

`scripts/prepare_topology_grant.py` and `scripts/run_topology_rehearsal.py` (new), `__init__.py`
(still says the scripts root is empty), `tests/test_surface_contract.py` (three edits, one of which
retires `FRONT_DOOR_ABSENCE_CLAIM` outright), `pyproject.toml`, and `tests/conftest.py` conditionally.
**None applied at HEAD.** The 58 REDs decompose as 51 in `test_scripts_inert.py` (of 31 parametrised
functions; the 2 passers run the AST guard over inline source and never load a script) plus the
`test_surface_contract.py` set, every one a hard `pytest.fail` from `conftest.require_c8_path`, not a
skip.

### Push gate at this working tree

**P0 = 0. P1 OPEN = 2** — F33 (deferred to the atomic entrypoint GREEN) and **F114** (new, proved).
**P1 repaired-unreviewed = 7** (F78, F85, F83, F86, F87, F103, F104 — F108 has left this bucket).
**P2 = 35** (+F115, F116, F117). **P3 = 39** (+F118, F119). The full-range independent verdict is
**NO-GO**. The gate `P0 = P1 = P2 = 0` is not met. **No part of the 105-commit local range is
push-eligible, and the atomic entrypoint GREEN stays blocked.** RUNTIME **HOLD**. Production
**Founder-only**.

### What the reviewers confirmed still holds

Surface inertness was verified **empirically**, not asserted: importing the package plus `runner` and
`adapter` with `builtins.open`, `os.open` and `subprocess.Popen` instrumented produced
`opened: [] spawned: []`. Single-spawn-site holds — `run_effect` (`adapter.py:241-251`) is the only
argv-to-runner handoff and `CommandAdapterAccessors` (`observe.py:661-693`) still publishes `.plan`
and not `.runner`. Anti-self-witnessing holds in `_grant_facts` (`runner.py:265-283`) and
`_selected_identity` (`:246-257`). Fail-closed construction holds: `ObservationVerdict.__post_init__`
(`observe.py:186-213`) makes an incoherent verdict unconstructible, and `guarded`
(`preparation.py:281-290`) bounds ordinary raises without swallowing `KeyboardInterrupt`/`SystemExit`.
