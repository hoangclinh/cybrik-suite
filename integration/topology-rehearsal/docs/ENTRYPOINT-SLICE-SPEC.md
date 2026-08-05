# Entrypoint slice — implementation spec derived from the live RED

Status: `DRAFT — SPECIFICATION ONLY — NOT IMPLEMENTED — NO RUNTIME AUTHORITY`.

This file records the exact contract the two absent entrypoint scripts must satisfy, read
off the committed RED tests rather than from intent. It authorizes no Docker effect, no
listener, no PostgreSQL attempt, no UAT, demo, merge, release or production action.

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

Parser requires `--execute` (bool), `--grant <path>`, `--signature <path>`.

`main(argv, *, execute=execute_authorized_attempt) -> int` calls `execute(args.grant,
args.signature)` positionally and returns its result.

`execute_authorized_attempt(grant_path, signature_path, *,
dependencies_loader=load_runtime_dependencies) -> int` must, in this exact order:

1. `authorization = dependencies.authorization_loader(grant_path, signature_path)`
2. `wiring = dependencies.wiring_builder(authorization=authorization)`
3. `result = dependencies.runner(authorization, wiring.adapters, execute_requested=True)`

`execute_requested` is the fixed literal `True`, not derived. Return `0` only when
`result.outcome == TOPOLOGY_PASS`, otherwise `HOLD_EXIT`, which must be non-zero.

`load_runtime_dependencies()` returns a triple whose members are identity-equal to
`load_authorization`, `build_runtime_wiring` and `runner.run_topology_rehearsal`.

`build_runtime_wiring(*, authorization, command_runner=None)` returns an object exposing
`.command_runner`, `.plan`, `.command_adapters` iterating exactly
`("controls", "docker", "host", "probe", "signature")`, `.adapters` as a `protocols.Adapters`
whose `identities/docker/host/probe/verifier` are the same objects as the corresponding
command adapters, and `.clock`/`.credential`/`.ledger` as concrete `MonotonicClock`,
`CredentialFileAdapter` and `AtomicFileAttemptLedger` reachable identically from `.adapters`.

## Three obstacles found before implementation

1. **Command adapters expose no public `.runner`/`.plan`.** The wiring test asserts
   `adapter.runner is command_runner` and `adapter.plan is wiring.plan` for all five command
   adapters, but the five classes in `adapter.py` store only private `_executor`/`_plan`, and
   only the internal `ExactCommandAdapter` has a public `.plan`. This slice therefore needs an
   additive `.runner`/`.plan` property pair on those five classes, or script-level wrappers.
   `adapter.py` is 799 lines against a strict 800-line bound, so an additive change there does
   not fit without first relocating something into `observe.py`, exactly as the earlier adapter
   size correction did.

2. **`repository_roots` has no derivation from the authorization.** The wiring test compares
   `wiring.plan.commands` against a plan built with
   `fakes.SYNTHETIC_REPOSITORY_ROOTS` (`{name: f"/synthetic/{name}"}`), but no field on
   `documents.Authorization` or `grant_document()` carries that value and no such string exists
   in `src/`. This must be resolved by design review, not guessed — either
   `build_runtime_wiring` takes its own `repository_roots` argument, or a reviewed source for
   it has to be named. `attempt_id` and `image_reference` are both derivable from the grant's
   observed and selected image identities using the existing `runner._attempt_names` formula.

3. **The front door currently asserts the scripts are absent.**
   `test_the_package_front_door_states_the_bounded_core_and_the_absent_remainder` asserts
   `not (SCRIPTS / name).exists()` for both names, so landing the scripts makes that control
   contradict itself. It must move to the present side in the same change, the way the runner's
   landing was handled in `244f9a4`, together with the `__init__.py` docstring.

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

- `test_the_wiring_offers_no_second_way_to_supply_the_control_roots`
  (`test_scripts_inert.py:562-581`), which asserts `"repository_roots" not in signature.parameters`,
  is itself the incorrect RED. It must be retired and replaced by one requiring the parameter to be
  **mandatory** — absent-argument construction must raise, not fall back.
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
  (`test_scripts_inert.py:201`) pins `execute_authorized_attempt` to call its builder as
  `build(authorization=authorization)`. The fake at `:216` is `def build(*, authorization)`
  and accepts no second keyword, so an implementation that passed `repository_roots` would
  raise `TypeError` against the fake.
- `test_default_dependency_loader_returns_the_reviewed_real_triple`
  (`test_scripts_inert.py:244`) pins `dependencies.wiring_builder is build_runtime_wiring` —
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

No GREEN is push-eligible until that further RED lands and is independently reviewed.

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
4. This file's own `DRAFT — SPECIFICATION ONLY — NOT IMPLEMENTED` banner becomes stale and the
   file is reconciled or retired; the tests remain the source of truth either way.

Over-claim check: none found. Every current banner is correctly hedged, `RUNTIME remains HOLD`
throughout, and the prohibition is already machine-gated — `test_surface_contract.py` matches
`\b(?:IMPLEMENTED|VERIFIED|PILOTED|GA|PRODUCTION)\b` against the package docstring and requires
zero hits.

## Scope this does not grant

Landing these scripts is still static library work. It does not authorize running either
script, Docker, a listener, a database, PKI, migration, runtime UAT, release, GA or
production. RUNTIME remains HOLD.
