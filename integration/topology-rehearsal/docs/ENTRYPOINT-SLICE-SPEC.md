# Entrypoint slice — implementation spec derived from the live RED

Status: `SCRIPTS LANDED AND INERT — STATIC ONLY — NO RUNTIME AUTHORITY`.

This file records the exact contract the two entrypoint scripts must satisfy, read off the
committed tests rather than from intent. Both scripts landed inert at `8a41f29`; the
`DRAFT — SPECIFICATION ONLY — NOT IMPLEMENTED` banner this file carried was *not* retired
there. It survived that landing and every commit up to and including `d679b69` — which is the
defect `F0148` was raised against — and was retired at `277a7bf`, as the owed-edit list at the
end of this file said it would be. Landing them
is static library work: this file authorizes no Docker effect, no listener, no PostgreSQL
attempt, no UAT, demo, merge, release or production action, and RUNTIME remains HOLD.

Source of truth remains the tests. Where this file and `tests/test_scripts_inert.py` or
`tests/test_surface_contract.py` disagree, the tests win and this file is wrong.

## Required paths

- `scripts/prepare_topology_grant.py`
- `scripts/run_topology_rehearsal.py`

`scripts/` must hold exactly those two `*.py` files and no subdirectory other than
`__pycache__`.

## Shared surface

Both scripts must import as a top-level module by file stem, carry a non-empty docstring,
and export exactly `HOLD_EXIT`, `build_parser`, `main` — with `run_topology_rehearsal.py`
additionally exporting `SubprocessCommandRunner`, `build_runtime_wiring` and
`execute_authorized_attempt`. `__all__` is compared as an exact set, so `load_authorization`
and `load_runtime_dependencies` must exist as module attributes but stay out of `__all__`.

`main([])` and `main(["--unknown"])` must both *return* `HOLD_EXIT`. A bare argparse parser
calls `parser.error()` and raises `SystemExit(2)` on an unknown flag, so the parser's error
handling has to be overridden or the `SystemExit` converted into the returned hold exit.

The scripts are not required to carry the `Status:` line that `C8_MODULES` must carry; that
control is parametrized over modules only.

## Inertness

Importing either script must leave `cybrik_suite_topology_rehearsal` absent from
`sys.modules`. Every package import must therefore be deferred into a function body — no
top-level package import in either script.

`prepare_topology_grant.py` may import none of the forbidden libraries.
`run_topology_rehearsal.py` may import exactly `subprocess` from that set, and its
`SubprocessCommandRunner.run` must be the only process-spawn site in the whole authored
tree: `subprocess.run(argv, shell=False, capture_output=True, timeout=timeout_seconds,
input=stdin)`, with `argv` passed positionally and never joined or interpolated.

## `prepare_topology_grant.py`

Parser requires `--prepare-unsigned` (bool) and `--output <path>` (str). The live tests pin
only the parser and the two hold-exit cases; `main`'s behaviour when the flags are actually
supplied is unspecified by the current RED.

## `run_topology_rehearsal.py`

This section is restated from the live tests at the argv-boundary shape `42bc6f7` adjudicated
and `015de49` landed. Line-number citations below are into `tests/test_scripts_inert.py` as
committed at `4230858`; where a citation and the file disagree, **the file wins**.

Those anchors have measurably drifted and most have not been reconverted. F0049 and F0079
recorded the drift, and it has since compounded: the four citations named by those findings moved
once under `015de49` and again under the commits after it — for example the anchor for
`test_default_composition_loads_builds_and_runs_the_same_authorization` read `:201`, was `:511`
when F0079 was written, and is `:543` today. Only the five citations those two findings named
have been converted to **test names**, which survive renumbering. Every remaining bare line range
*into `tests/test_scripts_inert.py`* is unverified and should be read as a hint toward a symbol,
never as evidence. Convert one to a test name whenever you have independently confirmed what it
points at.

That caveat is scoped to this section's citation basis and does **not** reach the bulleted
citations under "The evidence:" below, which point into `src/` modules and other test files and
stand on their own footing; they were not part of the `4230858` anchor set and are not disclaimed
here. An earlier draft of this paragraph disclaimed "every remaining bare line range in this
document", which retracted the evidentiary standing of this document's own security adjudication
— the one that answers the signature-envelope question REFUTED.

This section also predates `--attempt-ledger-root`. The signatures and the argv-shape band that
follow have been reconverted to carry it; any composition root shown elsewhere in this file
without `attempt_ledger_root` predates it, and the tests win.

Parser requires `--execute` (bool), `--grant <path>`, `--signature <path>`, a repeatable
`--control-root NAME=PATH` that *accumulates* into `args.control_root` in the order typed,
never replaces (pinned by `tests/test_scripts_inert.py:207-215`), and `--attempt-ledger-root
<path>` (`dest="attempt_ledger_root"`). Required-ness of `--control-root` and of
`--attempt-ledger-root` alike is deliberately not pinned at the parser — see the argv-shape
band below.

`main(argv, *, execute=execute_authorized_attempt) -> int` folds the `--control-root` tokens
into a mapping equal to `dict(NAME=PATH, …)`, validates the ledger worktree against those roots,
and calls `execute(args.grant, args.signature, repository_roots=<mapping>,
attempt_ledger_root=<path>)` — the two artifact paths positionally, the roots and the ledger
worktree as mandatory keywords — and returns its result (pinned by `:237-245` and, for the
ledger keyword, by `test_the_attempt_ledger_root_is_mandatory_at_both_frames_with_no_default`;
the default of `execute` is pinned by `:503-508`).

`main` owns the argv-**shape** refusal band, and it forwards a well-shaped mapping verbatim
rather than judging the key space:

- unstated `--control-root` returns `HOLD_EXIT` with the executor never called (`:270-301`);
- unstated `--attempt-ledger-root` does the same, and truthiness alone was not sufficient
  (F0092): the containment check needs the folded roots, so it runs after they are
  known (`test_an_invocation_that_names_no_attempt_ledger_root_holds_without_calling_the_executor`);
- a relative ledger root and one carrying an argv separator each hold by the same token rule
  the control roots are held to — `plan.absolute_normal_path`, which is `plan.exact_token`
  (and so separator-freedom), absoluteness **and normal form**; one lying inside a control
  worktree holds by the *containment* rule, which is a distinct check — the roots' own rules
  are exact key set, absolute, separator-free and normal-form, and no root is refused for
  lying inside another. **PATH** normal form is refused rather than canonicalised on **both**
  argv sides, so neither a root nor the ledger token can spell its way past the token rule
  (`test_a_non_normal_ledger_worktree_cannot_spell_its_way_inside_a_control_worktree`,
  `test_a_non_normal_control_worktree_cannot_hide_a_plainly_spelled_ledger_root`). Case and
  Unicode-normalization aliases are a different mechanism: they are **not** refused at the
  token — a case-variant or NFD-spelled path is an admissible token — but are folded on both
  operands *inside* the containment comparison, so they cannot alias one worktree into another
  (`test_a_case_variant_ledger_worktree_cannot_alias_into_a_control_worktree`,
  `test_a_case_variant_control_worktree_cannot_hide_a_plainly_spelled_ledger_root`,
  `test_a_normalization_variant_ledger_worktree_cannot_alias_into_a_control_worktree`,
  `test_the_containment_fold_is_canonical_and_not_merely_case_insensitive`). The token is
  never rewritten: it is forwarded exactly as typed
  (`test_a_relative_attempt_ledger_root_holds_because_it_names_no_fixed_worktree`,
  `test_an_attempt_ledger_root_inside_a_control_worktree_holds`,
  `test_the_attempt_ledger_root_is_held_to_the_argv_token_rule_the_control_roots_are`);
- each malformed token — `novalue`, `=/path`, `name=`, and a repeated name — does the same
  (`:308-355`);
- a typed `errors.PrecheckAbort` raised downstream is converted to a returned `HOLD_EXIT`,
  and the wrong-repositories mapping is recorded as forwarded unmodified (`:372-411`);
- the script may not restate `constants.CONTROL_REPOSITORIES` in its own code (`:438-500`).

`execute_authorized_attempt(grant_path, signature_path, *, repository_roots,
attempt_ledger_root, dependencies_loader=load_runtime_dependencies) -> int`.
`repository_roots` and `attempt_ledger_root` are both keyword-only with no default, no
variadic may accept either unnamed, and an invocation that omits `repository_roots` must
raise before the grant is opened (`:569-617`). The ledger worktree is mandatory at this frame
and at `build_runtime_wiring` alike, because a mandate stated at one frame only is satisfied
by the other frame inventing a value
(`test_the_attempt_ledger_root_is_mandatory_at_both_frames_with_no_default`). It must then,
in this exact order (`:538-566`):

1. `authorization = dependencies.authorization_loader(grant_path, signature_path)`
2. `wiring = dependencies.wiring_builder(authorization=authorization,
   repository_roots=repository_roots, attempt_ledger_root=attempt_ledger_root)`
3. `result = dependencies.runner(authorization, wiring.adapters, execute_requested=True)`

`execute_requested` is the fixed literal `True`, not derived. Return `0` only when
`result.outcome == TOPOLOGY_PASS`, otherwise `HOLD_EXIT`, which must be non-zero (`:641-659`).

`load_runtime_dependencies()` is zero-argument and answers an object whose
`authorization_loader`, `wiring_builder` and `runner` attributes are identity-equal to
`load_authorization`, `build_runtime_wiring` and `runner.run_topology_rehearsal` (`:620-630`).

`build_runtime_wiring(*, authorization, repository_roots, attempt_ledger_root,
command_runner=None)`. `repository_roots` and `attempt_ledger_root` are each mandatory
keyword-only with no default and no variadic widening, and a wiring built without either must
fail to be built at all rather than fall back
(`test_the_control_roots_are_a_mandatory_keyword_argument_with_no_default`, and for the ledger
worktree `test_the_attempt_ledger_root_is_mandatory_at_both_frames_with_no_default`). Every malformed
ledger root is refused with a typed `errors.PrecheckAbort` whose message is anchored on the
`attempt_ledger_root: ` prefix, which only this frame emits.
Every malformed roots argument is refused with a typed `errors.PrecheckAbort` naming
`repository_roots`, before anything is built and with nothing spawned (`:1118-1202`). The
injected roots must reach every planned observation as literal argv tokens (`:1011-1038`),
two wirings differing only in their roots must build two different plans (`:1040-1061`), and
the wiring may read neither the grant nor the host for a root (`:1223-1280`).

The returned object exposes `.command_runner`, `.plan`, `.command_adapters` iterating exactly
`("controls", "docker", "host", "probe", "signature")`, `.adapters` as a `protocols.Adapters`
whose `identities/docker/host/probe/verifier` are the same objects as the corresponding
command adapters, and `.clock`/`.credential`/`.ledger` as concrete `MonotonicClock`,
`CredentialFileAdapter` and `AtomicFileAttemptLedger` reachable identically from `.adapters`
(`:817-832`, `:1369-1384`). Each command adapter publishes the one shared `.plan` by identity
and **none** publishes the process executor under any public name (`:830`, `:964-1008`); the
default path must construct `SubprocessCommandRunner` exactly once, in `build_runtime_wiring`
itself and not inside a loop, comprehension or nested `def` (`:1304-1366`).

## Four obstacles found before implementation

Three were found in the first reading and are enumerated here; a fourth was found later, at
the composition root, and is recorded in its own section below. The heading counts all four.

1. **Command adapters exposed no public `.plan`, and the `.runner` half is withdrawn.**
   Status: the `.plan` half is **settled**; the `.runner` half is **refuted and gone**.
   `aae6a30` pinned both `adapter.runner is command_runner` and `adapter.plan is wiring.plan`
   on all five command adapters. Only the plan half survived review. The wiring tests now
   assert `wiring.command_adapters[name].plan is wiring.plan`
   (`tests/test_scripts_inert.py:830` and `:1005`), while
   `test_no_public_adapter_attribute_hands_out_the_unguarded_process_executor`
   (`tests/test_scripts_inert.py:964-1008`) requires that *no* public name on any command
   adapter hands out the executor, and the adapter-unit half asserts
   `not hasattr(instance, "runner")` across the whole MRO (`tests/test_adapter.py:146,150`).
   The additive accessor this obstacle asked for therefore landed as a `.plan`-only
   `CommandAdapterAccessors` mixin (`observe.py:510-543`), mixed into the five classes in
   `adapter.py` (`:254`, `:284`, `:342`, `:474`, `:509`); the shared-executor property the
   `.runner` accessor was serving is now proven behaviourally through the injected runner's
   ledger (`tests/test_scripts_inert.py:835-885`) and structurally on the default path
   (`:1304-1366`). The 800-line bound is why the mixin sits in `observe.py` rather than
   `adapter.py`, which is 799 lines; that siting is recorded as an open layering finding in
   `docs/REVIEW-LEDGER.md` (F11) and is not settled by this section.

2. **`repository_roots` has no derivation from the authorization.** The wiring test compares
   `wiring.plan.commands` against a plan built with
   `fakes.SYNTHETIC_REPOSITORY_ROOTS` (`{name: f"/synthetic/{name}"}`), but no field on
   `documents.Authorization` or `grant_document()` carries that value and no such string exists
   in `src/`. This must be resolved by design review, not guessed — either
   `build_runtime_wiring` takes its own `repository_roots` argument, or a reviewed source for
   it has to be named. `image_reference` is derivable from the grant's selected image
   identity. `attempt_id` is not a fresh derivation at all: `runner.attempt_id_for` (defined
   `runner.py:286`, exported `runner.py:81`) is already the one rendering of that identity in
   the package, and the composition root must call it directly, fed the grant's pinned
   `observed_image_identity.observed_at` instant — never a live host reading. It must not
   reach for `runner._attempt_names`, which is private and takes a `PreparationResult` the
   wiring does not hold.

3. **Discharged: the front door asserted the scripts were absent.**
   `test_the_package_front_door_states_the_bounded_core_and_the_absent_remainder` asserted
   `not (SCRIPTS / name).exists()` for both names, so landing the scripts made that control
   contradict itself. It had to move to the present side in the same change, the way the
   runner's landing was handled in `244f9a4`, together with the `__init__.py` docstring.
   That happened at `8a41f29` ("the atomic entrypoint GREEN, both scripts inert"):
   `tests/test_surface_contract.py` now asserts `(SCRIPTS / name).exists()` under the comment
   "Both entrypoints have landed. The control is inverted rather than deleted."

## Obstacle 2 is a defect in the RED, not a gap in the design

Obstacle 2 has since been settled by reading the seam end to end, and the answer is that the
committed RED asks for something no honest implementation can supply.

`plan.control_commands` embeds each repository root as a literal absolute argv token —
`("git", "-C", root, "rev-parse", "HEAD")` and its tree/status siblings — so `plan.commands`
carries the four roots verbatim. `test_runtime_wiring_injects_the_one_executor_into_every_command_adapter`
asserts `wiring.plan.commands == built_plan().commands`, and `built_plan()` builds with
`fakes.SYNTHETIC_REPOSITORY_ROOTS`, that is `/synthetic/<control>` for each of the four
controls.

The wiring helper calls `build_runtime_wiring(authorization=documents.authorization())` and
passes no roots. `documents.Authorization` carries `record`, `grant`, `grant_bytes`,
`signature_bytes`, `record_path`, `record_sha256`, `runner_aggregate_sha256`, `observed_at`
and `expected_controls` — and no repository roots. Neither the record nor the grant document
carries them either. The string `/synthetic` appears nowhere in `src/`.

So the assertion can only be satisfied by writing the fixture path `/synthetic/<name>` into
production source. That is the same self-witnessing failure the Admission slice removed and
the same prohibition that keeps synthetic digests out of the runner: a value invented to make
a fixture agree proves only that the invention was copied.

The correction is therefore a further RED commit, not a GREEN — the same handling the Docker
adapter evidence defect received, and history is preserved rather than rewritten. Commit
`82f0dd3` landed that RED and chose a host-observing default: `build_runtime_wiring` takes
`repository_roots` as a keyword-only argument, the wiring tests inject
`fakes.SYNTHETIC_REPOSITORY_ROOTS` explicitly, and the default was pinned to
`resolve_control_repository_roots`, a zero-argument callable that resolves the four control
roots by host observation at the composition root.

**That default is now superseded by a later RED.** Host observation cannot honestly resolve
three of the four `CONTROL_REPOSITORIES` — verified on this host, where the sibling-directory
convention such a resolver would need resolves to nothing outside this checkout itself
(`cybrik-suite`). A default built on that convention would either invent paths for
`cybrik-soc-command-center`, `cybrik-cyber-ai-platform` and `cybrik-security-tool-fabric`, or
silently produce a plan missing three of the four re-observed identities. Neither is honest,
and both are the same defect obstacle 2 already ruled out once: a value the runner cannot
actually derive being supplied anyway. History is preserved, not rewritten — `82f0dd3` is the
committed record of the host-observing attempt, and the further RED that replaces it does not
erase it.

### The envelope answer below is WITHDRAWN — do not implement it

Status: **SUPERSEDED AND REFUTED BY THE LIVE RED.** The bullets in this subsection instruct an
implementer to read the roots off `authorization.repository_roots`. The committed tests now
refuse exactly that, and following these bullets would land a signature bypass. This marker is
the correction; the paragraphs are retained, unedited, as the record of the answer that was
tested — the same handling Obstacle 3 receives below.

Two live sources refute it. Both are behavioural and committed, so the refutation survives
renumbering even where the anchors do not — the first is cited by test name and cannot drift at
all; the second is a bare range that can, and was last confirmed exact at `9bdb25c`:

- `tests/test_scripts_inert.py::test_the_control_roots_are_a_mandatory_keyword_argument_with_no_default`
  names the envelope answer and withdraws it by name in its docstring,
  then asserts the replacement behaviourally: `repository_roots` is `KEYWORD_ONLY` with
  `default is inspect.Parameter.empty`, no variadic may accept it unnamed, and
  `build(authorization=documents.authorization())` must raise `TypeError`. A wiring that read
  the roots off the envelope would satisfy none of that — it would build successfully from an
  authorization alone, which is the one outcome the test forbids.
- `tests/documents.py:218-227` records the withdrawal at the fixture: "This envelope
  deliberately carries no control-repository roots. A `repository_roots` field was drafted here
  and is withdrawn."

The security ground is the part worth carrying forward, because it is why this is not a matter
of taste. The detached signature covers `grant_bytes` alone and `record_sha256` hashes nothing,
so a root riding the envelope is an **unsigned** input. `plan` derives the allowed-signers file
and the detached signature path from the Suite root — so an unsigned root selects the trust
anchor of the very `ssh-keygen -Y verify` that checks the grant. The envelope answer does not
merely pick the wrong source; it lets an unsigned value redirect the verification of the signed
one. `expected_controls` is not a precedent for it: that field survives only because
`preparation` forces it to agree with the signature-covered grant pin, and a root has no signed
counterpart to be forced to agree with.

The answer that stands is the one stated under "The corrected answer: mandatory caller
injection, no default" further down this file: a mandatory keyword-only argument with no
default, supplied by the entrypoint from its own argv (`--control-root NAME=PATH`) at the same
operator-declared trust level as `execute_requested=True`.

The closing sentence of this subsection — that no `build_runtime_wiring` change is push-eligible
until "that further RED" lands — is withdrawn with it. The RED it waits on will never land,
because the design it was to encode is refuted; the argv-boundary RED it was superseded by is
already committed and failing. Nothing in this subsection gates the atomic entrypoint GREEN.

The corrected answer mirrors the one field this envelope already uses for exactly this
purpose. `documents.Authorization.expected_controls` (tests/documents.py:217) is consumed by
`preparation.py` (lines 776-785) via `getattr(authorization, "expected_controls", None)`
behind a named refusal, and it is drawn from the independently loaded record envelope —
never from `authorization.grant`, which is the exact self-witnessing boundary Admission
commit `1050684` established. `repository_roots` belongs in the same place, over the same
`CONTROL_REPOSITORIES` key space, with the same provenance and the same refusal idiom:

- `build_runtime_wiring` reads the roots from `authorization.repository_roots` on the
  loader-owned envelope — not from a host-observing default and not from `authorization.grant`.
- There is no host-observation default and no `resolve_control_repository_roots`. The
  envelope either carries the roots or it does not; a wiring handed an authorization without
  them has nothing honest to fall back to.
- A missing or malformed `repository_roots` field produces the same named refusal idiom
  `expected_controls` already uses, not a value resolved from somewhere else.
- The wiring tests still inject `fakes.SYNTHETIC_REPOSITORY_ROOTS`, but through the same
  construction path `expected_controls` already takes, so no test depends on the layout of
  the machine that runs it.

Until that further RED lands and a GREEN follows it, no `build_runtime_wiring` change is
push-eligible. Obstacle 1 is independent of this and can proceed on its own exact path.

## Obstacle 3: the `.runner` accessor the wiring RED asks for is an authority defect

Status: **ADJUDICATED — the authority claim below is REFUTED.** Independent review executed the
real adapters and plan builder rather than reasoning from this document, and found no principal
that gains a capability from the publication: `ExactCommandAdapter` has no `run` method at all
(`adapter.py:223-251`), a single underscore on `_executor._runner` is convention rather than a
barrier, the bundle's only consumers (`runner.run_topology_rehearsal`, `admission.decide`) never
touch `.runner`, and the composition root already holds the same object publicly as
`wiring.command_runner`. There is no exploit sketch. What survives is a **P2 layering** point, not
a security one: `observe.py` declares itself pure and reaching nothing (`observe.py:6-7`), and the
mixin makes that module the publisher of the process seam by reaching through another module's
private attribute — sited there by its own docstring for a line-count reason, which lets a size
bound decide a trust-layering question. The paragraphs below are retained as the record of the
claim that was tested; they are not the verdict.

Commit `aae6a30` pinned `adapter.runner is command_runner` and `adapter.plan is wiring.plan` on
every command adapter, and the uncommitted `CommandAdapterAccessors` mixin in `observe.py` supplies
both. The `.plan` half looks sound: `TopologyPlan` is inert reviewed data — a frozen dataclass of
argv tuples — so publishing it grants no authority to act, and `ExactCommandAdapter.plan` is the
existing precedent.

The `.runner` half is the problem. It forces every command adapter, including the five inside the
frozen `Adapters` bundle handed to the runner library, to publish the raw executor. A holder of
that bundle can then call `adapters.docker.runner.run(argv, ...)` with arbitrary argv and walk past
the plan-membership guard in `ExactCommandAdapter.run_effect` — the one check that keeps a
reachable command inside the reviewed plan. Identity is also the weaker of the two available
statements: it proves an adapter was *handed* the runner, while driving each adapter and reading
the injected runner's ledger proves it actually *uses* it, and hands the caller nothing.

The working tree contains a half-applied correction along these lines: a `LedgerRunner` and
`test_every_command_adapter_routes_its_commands_through_the_one_injected_runner` were added, but
`test_runtime_wiring_defaults_to_the_single_subprocess_executor` still reads `.runner`, the
forbidding test its docstring forward-references does not exist, and `aae6a30`'s `test_adapter.py`
assertion still stands. That set is therefore incoherent and is not push-eligible as it stands.

The same working tree also left obstacle 2 half-applied: `resolve_control_repository_roots` was
removed from the expected `__all__` in `test_entrypoint_surface_is_bounded`, but
`test_the_default_control_roots_are_observed_by_the_named_composition_root_resolver` still requires
that attribute to exist. One of the two must go, and by the reasoning above it is the resolver.

Open question that gates the envelope decision: whether `repository_roots` riding on the
authorization envelope is actually covered by `record_sha256` and the detached signature the way
`expected_controls` is. If it is not, an unsigned field would be redirecting the four
`git -C <root>` observations, and the envelope answer is worse than the alternatives it replaced.
That must be answered before any GREEN.

## Obstacle 2's envelope answer is REFUTED — it is a root-of-trust redirect

Status: **REFUTED.** The open question above ("is `repository_roots` on the envelope covered by
`record_sha256` and the detached signature the way `expected_controls` is?") has been answered by
reading the seam end to end, and the answer is **NOT COVERED**. The envelope answer is a defect
strictly worse than the host-observing default it replaced, and the working tree's
`documents.Authorization.repository_roots` field must not be committed as a contract.

The evidence:

- The detached signature covers **`grant_bytes` only** (`admission.py:671-681`), pinned to the
  grant mapping at `admission.py:589-594` and `admission.py:601-609`.
- There is no `record_bytes` anywhere in `src/` or `tests/`. `record_sha256` never hashes
  anything; its only three uses assert agreement (`admission.py:541-542`, `:548`, `:568`). It is
  transitively pinned to a *value* by the signature, but it does not cover the record's contents.
- `expected_controls` is therefore an **unsigned sidecar** of the in-memory envelope. It is not in
  the record (`documents.py:147-200`), not in the grant (whose per-repository object is fixed at
  `("commit", "tree", "clean")`, `grant.py:129`), and not in `AuthorizationSnapshot`
  (`admission.py:164-179`), so admission never sees it. Its only consumer is
  `preparation.py:775-778`.
- `expected_controls` is nonetheless safe, by a mechanism `repository_roots` **cannot borrow**:
  `preparation.py:560-567` requires every observed commit to equal *both* the unsigned envelope pin
  and the signature-covered grant pin. Tampering can only cause a refusal. Its integrity comes from
  forced agreement with the signed grant, not from signature coverage.
- No such signed counterpart exists for a root path, because the grant's per-repository key space is
  fixed and enforced (`grant.py:559`, `preparation.py:387`).
- And the roots do more than choose `git -C` worktrees. `plan.py:465-466` derives `suite_root` from
  them, and `plan.py:255-267` feeds it into `signature:verify` as both the allowed-signers file
  (`-f {suite_root}/{ALLOWED_SIGNERS_PATH}`) and the signature file (`-s`). An unsigned
  `repository_roots` therefore selects the **trust anchor for the on-host `ssh-keygen -Y verify`**.
  That is a root-of-trust redirect, not a control-identity redirect.
- The "loader-owned envelope" this section appealed to **does not exist**. `grep "class Authorization"
  src/` finds only `AuthorizationSnapshot`; `documents.Authorization` is a pure test double. The
  appeal was to an unwritten contract. The working tree compounds this by giving
  `repository_roots` a *default* (`documents.py:231-233`), so tests that claim to inject through the
  envelope are in fact riding a fixture default.

### The corrected answer: mandatory caller injection, no default

`build_runtime_wiring(*, authorization, repository_roots)` — mandatory keyword, no default, no
host observation, no envelope field, no constant in `src/`. The entrypoint script supplies the
roots from its own argv/config.

This proves the roots are an operator-declared input at the same trust level the design already
gives `execute_requested=True` (`runner.py:697,706`) and the choice of authorization file, and it
keeps every invented path out of `src/`. It is not a new pattern: `plan.build_plan` already takes
`repository_roots` as a mandatory keyword with no default and validates it exactly — exact key set,
absolute, separator-free (`plan.py:437-442`, `plan.py:175-186`) — and `tests/test_plan.py:44` and
`tests/test_adapter.py:76,707` already inject this way. Only the entrypoint wiring RED departed
from it.

Consequences for the committed RED, to be discharged by a further RED commit rather than a rewrite:

- `test_the_wiring_offers_no_second_way_to_supply_the_control_roots`, which asserted
  `"repository_roots" not in signature.parameters`, is itself the incorrect RED. It must be retired
  and replaced by one requiring the parameter to be **mandatory** — absent-argument construction
  must raise, not fall back. *Discharged:* that test no longer exists in the file; its replacement
  is `test_the_control_roots_are_a_mandatory_keyword_argument_with_no_default`, whose docstring
  records both the host-observing default and the envelope field as withdrawn.
- `documents.Authorization.repository_roots` and its default must be withdrawn; the wiring tests
  inject `fakes.SYNTHETIC_REPOSITORY_ROOTS` directly, as `test_plan.py` and `test_adapter.py` do.
- The refusal test `test_an_envelope_that_does_not_name_four_control_roots_is_refused` keeps its
  substance but moves to the injected argument.

The rejected alternatives are recorded so they are not revisited: adding `root` to the signed grant
is the only option that would make the answer COVERED, but it lets the document under check name the
worktree its own pins are checked against and still leaves the allowed-signers path grant-chosen;
host observation is refuted on this host, where none of the four `CONTROL_REPOSITORIES`
(`constants.py:208-213`) resolves as a sibling of this checkout; and absolute paths in
`constants.py` are invented paths, with `/synthetic/<name>` already enrolled in the leak detector
(`fakes.py:249`).

## Obstacle 4: the corrected answer stops one seam short of the composition root

Status: **OPEN — verified against the live tests at `3cd9d77`, gates the next RED.**

Mandatory caller injection is right, but `3cd9d77` applied it only to `build_runtime_wiring`.
The two callers above it were left on their prior shape, and the pair is unsatisfiable
end to end:

- `test_default_composition_loads_builds_and_runs_the_same_authorization`
  pins `execute_authorized_attempt` to call its builder as
  `build(authorization=authorization)`. Its in-test fake is `def build(*, authorization)`
  and accepts no second keyword, so an implementation that passed `repository_roots` would
  raise `TypeError` against the fake.
- `test_default_dependency_loader_returns_the_reviewed_real_triple`
  pins `dependencies.wiring_builder is build_runtime_wiring` —
  the real function, which `3cd9d77` made mandatory-keyword with no default.

Each test passes on its own: the first never touches the real builder, the second never calls
the callable whose identity it checks. Composed, the real default path can only ever raise
`TypeError: missing a required keyword-only argument: 'repository_roots'`. The RED as committed
therefore pins a composition root that no honest GREEN can drive, and `__all__`
(`test_entrypoint_surface_is_bounded`) forbids exporting any resolver that could fill the gap.

This is the same class of defect as obstacles 2 and 3 — a contract satisfiable test-by-test but
not as a whole — and it takes the same handling: a further RED commit that carries the injection
up to the argv boundary the corrected answer already named ("the entrypoint script supplies the
roots from its own argv/config"), not a rewrite. `main` is the only seam in this design that is
allowed to hold an operator-declared input; `--execute` already sits there at the same trust
level.

The same trade was later made a second time, for `--attempt-ledger-root`, and on the same
ground: it is an operator declaration at the trust level of `--execute` and the choice of grant
file. It differs from `--control-root` in what it buys — the roots decide the trust anchor of
the `ssh-keygen -Y verify` that checks the grant, whereas the ledger worktree decides only where
attempt budget is recorded — so the ledger root is refused when it lies *inside* any control
worktree rather than being allowed to select one. The residual accepted there and not closed:
a symlink or bind mount whose target is inside a control worktree still aliases past a textual
containment comparison, and no textual rule can see it. That route requires an aliasing
filesystem object to exist or be created for the purpose, which is itself an act at the trust
level of typing the control root.

No GREEN is push-eligible until that further RED lands and is independently reviewed.

### Obstacle 4 adjudicated: injection at the argv boundary

Independent architecture review read all the binding sites rather than the summary above, and
found the contradiction is **wider than this section first stated**. Three tests pin the builder
call shape, not one — `test_every_non_pass_result_maps_to_the_fixed_nonzero_hold_exit` also pins
`wiring_builder=lambda *, authorization` — and
`test_exact_execute_path_calls_one_injected_executor_with_external_paths` pins
`execute(grant_path, signature_path)` as exactly two positionals. Any correction must amend all
three.

**Decision: the roots are injected at the argv boundary.** `run_topology_rehearsal.py` gains a
repeatable, accumulating `--control-root NAME=PATH`, whose required-ness is pinned where the
operator observes it — as a returned `HOLD_EXIT` from `main` — and deliberately *not* as
`required=True` on the parser: `tests/test_scripts_inert.py:199-205` declines to assert the
`SystemExit` off a bare parser and permits either spelling, because `main([])` and
`main(["--unknown"])` must *return* the hold exit either way. `main` folds the pairs into a mapping
and forwards it as a mandatory keyword-only `repository_roots` through
`execute_authorized_attempt` into `build_runtime_wiring`, whose `3cd9d77` signature is unchanged.
`load_runtime_dependencies` stays zero-argument, and
`test_default_dependency_loader_returns_the_reviewed_real_triple` becomes satisfiable because the
composition root now supplies both keywords. Two private helpers `_control_root_pair` and
`_control_roots` split what the operator typed and observe nothing, so `__all__` does not change.
**The parser-flag bound is the one bound that moves.**

Rejected, recorded so they are not revisited:

- A fourth field on the object `load_runtime_dependencies()` returns — that callable is pinned
  zero-argument (`test_default_dependency_loader_returns_the_reviewed_real_triple`), so the
  field could only come from host observation or a source
  constant, both already refuted by `a5307cc`. It moves the dishonesty outside the AST guard
  instead of removing it.
- `functools.partial` binding to keep the builder one-argument — a partial is not
  `build_runtime_wiring` by identity, so
  `test_default_dependency_loader_returns_the_reviewed_real_triple` forces the partial to be
  formed at the call site,
  which is the keyword pass anyway; and partial keywords stay caller-overridable, which is
  strictly worse for the property being protected.
- Four fixed flags (`--suite-root` and siblings) — duplicates `constants.CONTROL_REPOSITORIES`
  into the script's parser; the repeatable form lets the script name no repository at all.
- A roots manifest file — a second unsigned artifact, less auditable than the invocation itself.

Two refusal bands, and they must not be merged. Argv **shape** — flag absent, token without `=`,
empty name, empty path, a repeated name — is refused in `main` and returns `HOLD_EXIT` with the
executor never called. Contract **semantics** — wrong key set, non-absolute, separator-carrying,
non-`str` — stays at `build_runtime_wiring` as `errors.PrecheckAbort` naming `repository_roots`,
which `main` converts to `HOLD_EXIT`. The key space is validated at exactly one site and must not
be duplicated into the script; a test pins that `main` forwards a well-shaped mapping of the
wrong repositories verbatim.

Test delta for the next RED, all in `tests/test_scripts_inert.py`: amend six
(`:154`, `:171`, `test_default_composition_loads_builds_and_runs_the_same_authorization`,
`:265`, and the comment only at `:285`), add six (a mandatory
keyword-only assertion on `execute_authorized_attempt` mirroring `:682` one frame up — its
absence is what let this contradiction land; argv→mapping parsing; hold when roots are unstated;
hold on each malformed token; a typed `PrecheckAbort` converted to `HOLD_EXIT`; and the
single-validation-site property). **Retire nothing** — `3cd9d77` already retired the only test
this correction would have contradicted.

Residual risks accepted, not fixed in code:

- `test_default_composition_loads_builds_and_runs_the_same_authorization` pins the loader
  *before* the builder, so the grant and signature files are read before
  the roots are validated. Nothing spawns and no trust decision happens in that window, but if
  `load_authorization` ever acquires a verification step this order must be revisited.
- The trust anchor is now operator-typed: `--control-root cybrik-suite=<path>` selects the
  allowed-signers file and signature path for `ssh-keygen -Y verify` (`plan.py:465-466`,
  `:255-267`). That is the deliberate trade — the anchor is visible in the invocation record
  instead of hidden in a default, at the same trust level as `--grant` — but shell history and CI
  job definitions become the audit surface.
- The AST guard at `:841` is scoped to `build_runtime_wiring`, so the two new private helpers are
  unguarded and could later acquire `os.environ` or `Path.cwd()` unnoticed. Optional hardening
  once the GREEN has chosen their names.
- `authored_sources()` includes `scripts/`, so `run_topology_rehearsal.py` must hold the parser,
  `main`, the composition root, `SubprocessCommandRunner` and the adapter wiring under 800 lines.
  If it breaches, the fix is relocation as `69ed068` did — never a shrunk docstring.

Slicing, no overlapping paths: this docs commit; then a tests-only RED owning exactly
`tests/test_scripts_inert.py`; then an atomic GREEN owning exactly the two scripts,
`src/cybrik_suite_topology_rehearsal/__init__.py` and `tests/test_surface_contract.py`. The last
two are **forced** into the GREEN and cannot be deferred: `test_surface_contract.py:179` asserts
the scripts are absent while `:434` and `:438` require them present, so the front door flips in
the same change, exactly as `244f9a4` handled the runner's landing. Both scripts must land
together, because the scripts-root control pins exactly two files.

## Front-door reconciliation owed when the scripts land

Surveyed at `2b864e3`. The reconciliation is **entirely self-contained**: no file outside
`integration/topology-rehearsal/` names this component at all. The repo-root `README.md` line 40
describes only the parent `integration/` directory in aggregate, and `integration/README.md`'s
directory table lists `compose/`, `helm/`, `fixtures/` and `compatibility/` — `topology-rehearsal/`
is not a row in it. `contracts/`, `releases/`, `docs/README.md`, `AGENTS.md` and the root
`CLAUDE.md` do not mention it either. So there is no external claim to correct; adding a row to
`integration/README.md` would be a net-new registration, not a reconciliation.

The repo-root validator does **not** gate this component. `tools/contract-validation/validate.mjs`
never references `integration/topology-rehearsal` or `cybrik_suite_topology_rehearsal`. Its
`validate-topology-rehearsal.mjs` step validates a same-named but different thing — the
`docs/uat/topology-rehearsals/*` record registry. That name collision must not be mistaken for
coverage: the only automated front-door gate over this component is its own
`tests/test_surface_contract.py`.

Test-pinned edits owed, all inside the component:

1. `src/cybrik_suite_topology_rehearsal/__init__.py` — the sentence placing the scripts root on
   the absent side must move to the present side, in the same commit that lands the scripts.
   Two controls enforce this, so it is not cosmetic:
   `test_the_package_front_door_states_the_bounded_core_and_the_absent_remainder`
   (`test_surface_contract.py:178-179`, currently asserting `not (SCRIPTS / name).exists()`) and
   `test_the_front_door_places_every_module_on_the_side_it_is_actually_on`. Handled the way the
   runner's landing was in `244f9a4`.
2. `pyproject.toml` — the banner's "only the two entrypoint scripts remain intentionally RED and
   absent" and the `description` field both become false. `PROJECT_STATUS` is a verbatim
   test-pinned constant checked in both `pyproject.toml` and `tests/conftest.py` by
   `test_project_and_harness_headers_state_the_mixed_c8a_lifecycle_truthfully`, so whether the
   "PARTIALLY PRESENT / LATER MODULES RED" framing survives is a decision, not free text.
3. `docs/REVIEW-LEDGER.md` — a new appended row, never an edit to a prior verdict.
4. **Discharged:** this file's own `DRAFT — SPECIFICATION ONLY — NOT IMPLEMENTED` banner became
   stale when the scripts landed at `8a41f29` and has been reconciled at the head of this file
   to `SCRIPTS LANDED AND INERT — STATIC ONLY — NO RUNTIME AUTHORITY`; the tests remain the
   source of truth either way.

Over-claim check: none found. Every current banner is correctly hedged, `RUNTIME remains HOLD`
throughout, and the prohibition is already machine-gated — `test_surface_contract.py` matches
`\b(?:IMPLEMENTED|VERIFIED|PILOTED|GA|PRODUCTION)\b` against the package docstring and requires
zero hits.

## Scope this does not grant

Landing these scripts is still static library work. It does not authorize running either
script, Docker, a listener, a database, PKI, migration, runtime UAT, release, GA or
production. RUNTIME remains HOLD.

## Correction: the owed-edit list above is incomplete

`0190f03` listed four owed edits and named `test_surface_contract.py:178-179` only as a
*control* enforcing item 1. Reading the two front-door controls against the landed tree shows
that file is not merely the enforcer — it is itself an owed edit, and so is
`tests/conftest.py`. The atomic GREEN therefore owns six paths, not four.

`test_the_package_front_door_states_the_bounded_core_and_the_absent_remainder`
(`test_surface_contract.py:178-179`) asserts `not (SCRIPTS / name).exists()` for both script
names. `test_both_inert_entrypoints_exist` (`:434-435`) asserts the same two paths *do* exist.
The two controls are contradictory by construction: exactly one of them is RED at any time, and
landing the scripts flips which one. No prose edit to `__init__.py` can satisfy the absence
assertion once the files are on disk, so the absence pin must move in the same commit.

The same applies to `test_the_front_door_places_every_module_on_the_side_it_is_actually_on`
(`:231`), which requires `FRONT_DOOR_SCRIPT_CLAIM` ("both entrypoint scripts") to sit inside the
sentence carrying `FRONT_DOOR_ABSENCE_CLAIM`. Once the scripts are present that placement is the
overstatement inverted: the front door would be describing landed files as absent, which is what
`:203-234` exists to forbid for modules. The script claim must move to the present sentence and
the control must move with it.

`tests/conftest.py` is owed only conditionally. `PROJECT_STATUS` is asserted verbatim in both
`pyproject.toml` and `conftest.py` by
`test_project_and_harness_headers_state_the_mixed_c8a_lifecycle_truthfully` (`:140-148`). If the
"BOUNDED C8 LIBRARY CORE PARTIALLY PRESENT — LATER C8 MODULES RED" framing is retired when the
last RED module lands, both files must change together in the same commit or that control goes
RED on the half-edit.

Owed paths for the atomic GREEN, restated:

1. `scripts/prepare_topology_grant.py` — new.
2. `scripts/run_topology_rehearsal.py` — new.
3. `src/cybrik_suite_topology_rehearsal/__init__.py` — the scripts sentence moves to the present
   side.
4. `tests/test_surface_contract.py` — three edits, not one, and the third is a control that
   genuinely goes away rather than moves:
   - the absence pin at `:178-179` (`assert not (SCRIPTS / name).exists()`) moves to the
     present side, against `test_both_inert_entrypoints_exist` (`:434-435`);
   - the script-claim placement at `:231` (`FRONT_DOOR_SCRIPT_CLAIM in absence_sentence`)
     moves to the present sentence, for the reason given above;
   - `FRONT_DOOR_ABSENCE_CLAIM` itself (`:73`, `"remain absent, and their tests stay RED"`)
     is owed a decision, and this list previously did not say so. `FRONT_DOOR_ABSENT_MODULES`
     is already `()` (`:77`), so once the two scripts land nothing in the component is absent
     — yet `:176` still requires the claim string to appear in the front-door docstring and
     `:226` still requires *exactly one* sentence to carry it, while `:227-230` forbid that
     sentence from naming any present module and `:231`'s move forbids it from naming the
     scripts. The only docstring satisfying all four at once carries a sentence about
     nothing. The honest replacement is to retire `FRONT_DOOR_ABSENCE_CLAIM` (`:73`), the
     docstring requirement at `:176` and the `absence_sentence` half of `:226-231` together,
     and to keep the falsifiability they were carrying in the halves that still have subject
     matter: `:184`'s `absent == FRONT_DOOR_ABSENT_MODULES`, `:185`'s
     `present == FRONT_DOOR_PRESENT_MODULES`, and the present-sentence placement at
     `:220-224`, extended so both script names must sit on the present side exactly as the
     modules do today.

   That third item **is** a weakening in the strict sense — an assertion the tree makes today
   stops being made — so this list's former sentence "Nothing else in that file weakens" is
   withdrawn as false. The narrower claim that survives: no control over anything that still
   exists is weakened. The size bound (`:237-249`), the single-spawn-site control
   (`:355-431`), the scripts-root inventory (`:438-450`) and the unevidenced-status regex
   (`:233`) stay exactly as reviewed. Retiring an absence control at the moment its subject
   stops being absent is not the same as relaxing a bound, but it must be reviewed as a
   deletion and recorded as one, not filed under "moves".
5. `pyproject.toml` — banner sentence and `description` stop claiming the scripts are absent.
6. `tests/conftest.py` — only if `PROJECT_STATUS` itself is retired, and then in lockstep with
   `pyproject.toml`.

`docs/REVIEW-LEDGER.md` still takes an appended row, and this file's own `DRAFT` banner is still
reconciled or retired, but neither is test-pinned and neither has to be atomic with the scripts.

This correction changes no control and weakens no test. It records that a commit landing only
the four paths `0190f03` named would leave the broad census RED for a reason the slice itself
created. RUNTIME remains HOLD.
