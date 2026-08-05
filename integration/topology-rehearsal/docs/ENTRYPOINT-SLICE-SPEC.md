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

## Scope this does not grant

Landing these scripts is still static library work. It does not authorize running either
script, Docker, a listener, a database, PKI, migration, runtime UAT, release, GA or
production. RUNTIME remains HOLD.
