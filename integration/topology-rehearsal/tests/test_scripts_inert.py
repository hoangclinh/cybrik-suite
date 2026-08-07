"""The two operator entrypoints are inert unless exact explicit flags are supplied."""

from __future__ import annotations

import ast
import inspect
import sys
import textwrap
import unicodedata
from collections.abc import Mapping, Sequence
from pathlib import Path
from types import SimpleNamespace

import documents
import fakes
import pytest
from conftest import (
    C8_SCRIPT_NAMES,
    PACKAGE,
    ROOT,
    load_c8,
    load_c8_script,
    require_c8_attr,
)


@pytest.fixture(autouse=True)
def restore_imported_modules():
    """Leave `sys.modules` exactly as it was found.

    These tests deliberately unload the C8 package to prove an entrypoint does not import
    it; without this the next test in the session would observe a half-unloaded interpreter
    and could pass or fail for a reason that has nothing to do with its own subject.
    """
    snapshot = dict(sys.modules)
    path_snapshot = list(sys.path)
    try:
        yield
    finally:
        for name in set(sys.modules) - set(snapshot):
            del sys.modules[name]
        sys.modules.update(snapshot)
        sys.path[:] = path_snapshot


def built_plan():
    plan = load_c8("plan")
    return require_c8_attr(plan, "build_plan")(
        attempt_id=fakes.SYNTHETIC_ATTEMPT_ID,
        image_reference=f"postgres@{fakes.SYNTHETIC_MANIFEST_DIGEST}",
        repository_roots=fakes.SYNTHETIC_REPOSITORY_ROOTS,
    )


# The two external artifact paths every runner invocation names. Nothing in this file opens
# them — they are only ever forwarded — so they stay literal strings rather than real files.
GRANT_PATH = "/tmp/grant.json"
SIGNATURE_PATH = "/tmp/grant.json.sig"

# The durable one-attempt budget's own worktree, declared separately from the four control
# roots. It is deliberately not a subpath of any of them: the whole point of the separate
# declaration is that re-checking-out a control worktree cannot move the ledger, and a
# fixture that nested the two would let a siting bug pass unseen.
ATTEMPT_LEDGER_ROOT = "/tmp/cybrik-attempt-ledger"


def control_root_flags(roots: Mapping[str, str]) -> list[str]:
    """The `--control-root NAME=PATH` tokens an operator types in order to name `roots`.

    Repeatable rather than comma-joined, and four separate declarations rather than four
    fixed flags: a joined value would need escaping and could hide one root inside another's
    token, while fixed flags would copy `constants.CONTROL_REPOSITORIES` into the script's
    parser and take away its ability to name no repository at all.
    """
    return [
        token
        for name, root in roots.items()
        for token in ("--control-root", f"{name}={root}")
    ]


def execute_argv(
    roots: Mapping[str, str] | None = None,
    *,
    attempt_ledger_root: str | None = ATTEMPT_LEDGER_ROOT,
) -> list[str]:
    """One complete authorized invocation: the artifacts, the roots and the ledger worktree.

    `attempt_ledger_root=None` builds the otherwise-complete invocation that omits the ledger
    declaration, which is what the mandatory-ness control needs and what no other helper can
    express.
    """
    named = fakes.SYNTHETIC_REPOSITORY_ROOTS if roots is None else roots
    ledger_flags = (
        [] if attempt_ledger_root is None else ["--attempt-ledger-root", attempt_ledger_root]
    )
    return [
        "--execute",
        "--grant",
        GRANT_PATH,
        "--signature",
        SIGNATURE_PATH,
        *control_root_flags(named),
        *ledger_flags,
    ]


def runtime_wiring(script, **overrides):
    """Build the wiring the way the composition root does, with the control roots injected.

    Every `control:<repository>:*` entry in `plan.commands` carries its root as a literal
    argv token, so the four roots decide what the plan *is*, and where they come from is a
    contract question rather than a test convenience. Three candidate sources were examined
    and all three are refused. The grant is self-witnessing: a plan derived from the document
    under check can only ever agree with it, which is the boundary Admission established. The
    host is not honest either — the sibling-directory convention a resolver would need
    resolves only `cybrik-suite` on a real checkout, so three of the four roots would have to
    be invented, and every command-plan assertion in this file would become a statement about
    the machine that ran it. The authorization envelope is the worst of the three: the
    detached signature covers `grant_bytes` alone, so a root riding the envelope would be an
    unsigned value selecting the allowed-signers file that `signature:verify` trusts.

    What is left is the caller. The roots are an operator-declared input at the same trust
    level as `execute_requested=True` and the choice of authorization file, and they are
    passed here as a mandatory argument — the identical construction `tests/test_plan.py`
    and `tests/test_adapter.py` already use against `plan.build_plan`. That is also what
    keeps the fixture strings out of the implementation, where
    `test_no_synthetic_fixture_value_leaks_into_the_implementation` forbids them outright.

    `setdefault` rather than a defaulted parameter, so a test can inject `None` — or any
    other malformed value — and have it actually reach the wiring.
    """
    overrides.setdefault("authorization", documents.authorization())
    overrides.setdefault("repository_roots", fakes.SYNTHETIC_REPOSITORY_ROOTS)
    overrides.setdefault("attempt_ledger_root", ATTEMPT_LEDGER_ROOT)
    return require_c8_attr(script, "build_runtime_wiring")(**overrides)


def owned_suite_repository_roots(owned_root: Path) -> dict[str, str]:
    """The four roots, with the Suite one pointed at a real directory the caller owns.

    Three of the four stay synthetic because nothing reads them from disk. The Suite root
    does not: `plan.signature_path` is built underneath it, and the signature adapter reads
    that file before and after it verifies, so proving that adapter routes through the
    injected runner needs a Suite root that really exists. `tests/test_adapter.py` already
    builds its signature plans this way; this is the same construction reached through
    `build_runtime_wiring` instead of through `build_plan` directly.
    """
    return {
        **fakes.SYNTHETIC_REPOSITORY_ROOTS,
        fakes.SUITE_CONTROL: str(owned_root),
    }


def control_root_argument(command: tuple[str, ...]) -> str:
    """The exact worktree a `git -C <root> ...` observation is bound to."""
    return command[command.index("-C") + 1]


def names_this_checkout(token: str) -> bool:
    """True when an argv token names this working tree or any ancestor of it.

    A wiring that accepted `repository_roots` and then resolved host roots anyway would
    plan against the checkout these tests are running from, or a parent of it. No reviewed
    argv token — not `/usr/bin/git`, not an injected `/synthetic/<control>` root — has that
    property, so this is an exact witness for "the injected roots were ignored".
    """
    if not token.startswith("/"):
        return False
    return ROOT == Path(token) or ROOT.is_relative_to(Path(token))


@pytest.mark.parametrize("name", C8_SCRIPT_NAMES)
def test_importing_an_entrypoint_has_no_runtime_or_package_side_effect(name: str) -> None:
    for loaded in tuple(sys.modules):
        if loaded == PACKAGE or loaded.startswith(f"{PACKAGE}."):
            sys.modules.pop(loaded, None)
    sys.modules.pop(name.removesuffix(".py"), None)
    script = load_c8_script(name)
    assert script.__name__ == name.removesuffix(".py")
    assert not any(
        loaded == PACKAGE or loaded.startswith(f"{PACKAGE}.")
        for loaded in sys.modules
    )


@pytest.mark.parametrize("name", C8_SCRIPT_NAMES)
def test_no_arguments_returns_the_fixed_hold_exit(name: str) -> None:
    script = load_c8_script(name)
    assert require_c8_attr(script, "main")([]) == require_c8_attr(script, "HOLD_EXIT")


@pytest.mark.parametrize("name", C8_SCRIPT_NAMES)
def test_unknown_arguments_fail_closed(name: str) -> None:
    script = load_c8_script(name)
    assert require_c8_attr(script, "main")(["--unknown"]) == require_c8_attr(
        script, "HOLD_EXIT"
    )


def test_prepare_entrypoint_requires_the_exact_unsigned_prepare_flag() -> None:
    script = load_c8_script("prepare_topology_grant.py")
    parser = require_c8_attr(script, "build_parser")()
    args = parser.parse_args(["--prepare-unsigned", "--output", "/tmp/grant.json"])
    assert args.prepare_unsigned is True
    assert args.output == "/tmp/grant.json"


def test_runner_entrypoint_requires_exact_execute_plus_external_artifact_paths() -> None:
    """The parser gains one repeatable option, and it accumulates rather than replaces.

    `--control-root NAME=PATH` is the argv boundary the four control worktrees enter
    through, and the parser bound is the one bound this correction moves. Accumulation is
    asserted because it is the half an implementation can get wrong silently: an option that
    replaced on each occurrence would reduce four declared roots to one and leave three to be
    answered by something nobody named, which is the same failure every refuted derivation
    shared. The existing `--execute`, `--grant` and `--signature` contracts are unchanged
    and re-asserted here so the two are read together.

    Required-ness is deliberately pinned where an operator observes it — see
    `test_an_invocation_that_names_no_control_root_holds_without_calling_the_executor` —
    rather than as a `SystemExit` off the bare parser here. The shared-surface contract
    already permits either spelling, since `main([])` and `main(["--unknown"])` must *return*
    the hold exit and an implementation may reach that either by converting the `SystemExit`
    argparse raises or by overriding `parser.error`. Asserting the raise here would forbid
    the second spelling while proving nothing more about the returned exit code.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    parser = require_c8_attr(script, "build_parser")()
    args = parser.parse_args(execute_argv())
    assert args.execute is True
    assert args.grant == GRANT_PATH
    assert args.signature == SIGNATURE_PATH
    assert list(args.control_root) == [
        f"{name}={root}" for name, root in fakes.SYNTHETIC_REPOSITORY_ROOTS.items()
    ]


def test_exact_execute_path_calls_one_injected_executor_with_external_paths() -> None:
    """`main` hands the executor the two paths it was given and the roots it was typed.

    Amended from the two-positional call shape `3cd9d77` left behind. That shape was
    unsatisfiable end to end rather than merely incomplete: `3cd9d77` made `repository_roots`
    a mandatory keyword-only argument of `build_runtime_wiring`, while `main` had no seam to
    forward roots through and `load_runtime_dependencies` is pinned to return that real
    builder *by identity*, so the default composition could only ever raise `TypeError:
    missing a required keyword-only argument`. Each test passed alone and no honest
    implementation satisfied the set.

    The roots enter at argv, which is the one seam in this design allowed to hold an
    operator-declared input — `--execute` and the choice of grant file already sit there at
    the same trust level — and `main` forwards them as a mandatory keyword so no frame
    between the operator and the plan can supply them instead.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    calls: list[tuple[object, ...]] = []

    def execute(
        grant_path: str, signature_path: str, *, repository_roots, attempt_ledger_root
    ) -> int:
        calls.append((grant_path, signature_path, repository_roots, attempt_ledger_root))
        return 0

    exit_code = require_c8_attr(script, "main")(execute_argv(), execute=execute)
    assert exit_code == 0
    assert calls == [
        (
            GRANT_PATH,
            SIGNATURE_PATH,
            dict(fakes.SYNTHETIC_REPOSITORY_ROOTS),
            ATTEMPT_LEDGER_ROOT,
        )
    ]


def recording_executor(calls: list[tuple[object, ...]]):
    """An executor that records every call it receives and answers the success code.

    `0` rather than the hold exit, deliberately. An implementation that entered the executor
    where it should have refused would otherwise hand back the very code the refusal is
    asserted against, and the refusal assertion would pass for the wrong reason. Answering
    the success code keeps the two outcomes distinguishable from the return value alone, and
    the recorded list then names the call that should never have happened.

    The call shape is the one
    `test_exact_execute_path_calls_one_injected_executor_with_external_paths` already pins,
    so a `main` that forwards correctly is accepted here and only a `main` that forwards when
    it owed a refusal is recorded.
    """

    def execute(
        grant_path: str, signature_path: str, *, repository_roots, attempt_ledger_root
    ) -> int:
        calls.append((grant_path, signature_path, repository_roots, attempt_ledger_root))
        return 0

    return execute


def test_an_invocation_that_names_no_control_root_holds_without_calling_the_executor() -> None:
    """An unstated `--control-root` is refused in `main`, before either artifact is opened.

    This is the test `test_runner_entrypoint_requires_exact_execute_plus_external_artifact_paths`
    forward-references at `:199-205`: required-ness is pinned where the operator observes it,
    as a returned `HOLD_EXIT`, rather than as a `SystemExit` off the bare parser. Its absence
    left the contract satisfiable by a `main` that folds an unstated flag to `{}` and forwards
    it, because `{}` is a *well-shaped* mapping and its refusal therefore belongs to the other
    band — `build_runtime_wiring`, which the real `execute_authorized_attempt` reaches only
    after `load_authorization` has already opened the grant and the signature. The operator
    would then be told the worktrees were unnamed by a path that had first read two artifacts
    it had no authority to read, which is exactly the ordering
    `test_the_control_roots_are_mandatory_at_the_composition_root_as_well` forbids one frame
    up and which `:265-269` carries as a named residual risk on the authorized path only.

    The empty ledger is the load-bearing half. A returned code alone cannot separate a refusal
    taken in `main` from one taken after the executor was entered, so the recording executor
    answers `0` and a `main` that called it fails both assertions rather than accidentally
    agreeing with the expected one.

    One spelling, not a fourth: the refusal is a *returned* `HOLD_EXIT`, the same spelling
    `test_no_arguments_returns_the_fixed_hold_exit` and `test_unknown_arguments_fail_closed`
    already use for every other argv-shape mistake.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    calls: list[tuple[object, ...]] = []
    exit_code = require_c8_attr(script, "main")(
        ["--execute", "--grant", GRANT_PATH, "--signature", SIGNATURE_PATH],
        execute=recording_executor(calls),
    )
    assert exit_code == require_c8_attr(script, "HOLD_EXIT")
    assert calls == [], "an invocation that named no worktree may not reach the executor"


# Every way one `--control-root` token can be malformed in *shape*, which is the band `main`
# owns. None of these is a question about which repositories exist — that is the key space,
# validated at exactly one site and never restated here — so each is decidable from the token
# alone, or from the token together with what was already typed.
MALFORMED_CONTROL_ROOT_TOKENS = [
    pytest.param("novalue", id="no-separator"),
    pytest.param(f"=/synthetic/{fakes.SUITE_CONTROL}", id="empty-name"),
    pytest.param(f"{fakes.SUITE_CONTROL}=", id="empty-path"),
    pytest.param(f"{fakes.SUITE_CONTROL}=/synthetic/elsewhere", id="repeated-name"),
]


@pytest.mark.parametrize("token", MALFORMED_CONTROL_ROOT_TOKENS)
def test_a_malformed_control_root_token_holds_without_calling_the_executor(
    token: str,
) -> None:
    """A token that cannot be read as `NAME=PATH` ends the invocation in `main`.

    Each token is appended to an otherwise *complete and authorized* invocation, so the
    refusal cannot be attributed to anything else that was typed: the four worktrees are
    already named, the two artifact paths are already given, and the only difference between
    this argv and the one
    `test_exact_execute_path_calls_one_injected_executor_with_external_paths` executes is the
    one token under test. A `main` that silently discarded what it could not parse would be
    left holding four well-formed roots and would execute, which is the defect each case is
    aimed at rather than a hypothetical one.

    The four cases are the four shape mistakes the slice specification enumerates. `novalue`
    has no separator at all and so names nothing. `=/synthetic/...` has an empty name, which
    would otherwise fold into a mapping keyed by `""`. `cybrik-suite=` has an empty path,
    which would plan `git -C ''` against the operator's own working directory. The repeated
    name is malformed only in relation to what was already typed — the token is well formed
    read alone — and it is the one case a per-token check cannot see: an accumulating parser
    that let the last occurrence win would quietly answer the operator's *first* declaration
    with their second, and both are absolute, `str` and separator-free, so the semantics band
    downstream would accept the result without complaint.

    The empty ledger carries the same weight it carries above. It is what distinguishes the
    shape band from the semantics band: an implementation that merged the two — folding a
    malformed token into the mapping and letting `build_runtime_wiring` object — would enter
    the executor and be recorded here even though its final exit code could still be a hold.

    One spelling, as above: a returned `HOLD_EXIT`, never a raise.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    calls: list[tuple[object, ...]] = []
    exit_code = require_c8_attr(script, "main")(
        [*execute_argv(), "--control-root", token],
        execute=recording_executor(calls),
    )
    assert exit_code == require_c8_attr(script, "HOLD_EXIT")
    assert calls == [], f"a malformed token {token!r} may not reach the executor"


def wrong_repositories() -> dict[str, str]:
    """Four roots that are well formed in every way except which repositories they name.

    Each key is a non-empty `str`, each value is an absolute separator-free path, and there
    are four of them, so nothing in the argv-shape band has anything to say about this
    mapping. The only thing wrong with it is the key space — and the key space belongs to
    `plan`, which is the one site that validates it.
    """
    return {
        f"{name}-mirror": f"{root}-mirror"
        for name, root in fakes.SYNTHETIC_REPOSITORY_ROOTS.items()
    }


def test_a_typed_precheck_abort_from_the_wiring_is_returned_as_the_hold_exit() -> None:
    """The wrong repositories pass through `main` verbatim and come back as a hold.

    Both halves of the semantics band are stated here because they are one invocation. The
    forwarding half is the single-validation-site contract observed behaviourally: `main` is
    handed four well-shaped roots naming a repository space the contract does not own, and it
    must forward that mapping *unmodified* rather than judge it. A `main` that carried its own
    copy of the key space would refuse before the executor was entered and leave the recorded
    mapping empty, which is the defect this half exists to catch;
    `test_the_script_does_not_restate_the_control_repository_key_space` states the same
    property structurally, and the two are meant to be read together for the reason `:983`
    gives — a duplicated check taken only on some path satisfies a behavioural test and is
    still a duplicated check.

    The conversion half is what keeps the operator's experience honest. The refusal that
    really occurs downstream is a typed `errors.PrecheckAbort` naming `repository_roots`, the
    exact refusal `test_a_roots_argument_that_does_not_name_four_control_roots_is_refused`
    pins at the wiring. `main` is the process boundary, so it owes the operator an exit code
    rather than a traceback: an escaping exception would be a fourth spelling of one operator
    mistake, and this file's own principle at `:924` — and the third refusal spelling already
    recorded against it — is that one mistake gets one answer. The injected executor raises
    the real reviewed type, not a stand-in, so a `main` that caught something narrower or
    broader than `PrecheckAbort` is not accepted here.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    abort = require_c8_attr(load_c8("errors"), "PrecheckAbort")
    wrong = wrong_repositories()
    forwarded: list[object] = []

    def execute(
        grant_path: str, signature_path: str, *, repository_roots, attempt_ledger_root
    ) -> int:
        forwarded.append(repository_roots)
        raise abort(
            "repository_roots must be exactly the reviewed control repositories"
        )

    exit_code = require_c8_attr(script, "main")(execute_argv(wrong), execute=execute)
    assert exit_code == require_c8_attr(script, "HOLD_EXIT")
    assert forwarded == [dict(wrong)], (
        "main must forward a well-shaped mapping verbatim, never judge the key space itself"
    )


def docstring_constants(tree: ast.AST) -> set[int]:
    """The identity of every string constant that is a module, class or function docstring.

    Documentation is exempt from the literal walk below and executable code is not, because
    the two cannot decide anything alike: a usage example in a help text or a docstring is
    read by an operator, while a literal in an expression is read by the parser and can
    branch. Identity is used rather than the string itself so that an identical string
    appearing in both positions is still caught in the position that matters.
    """
    holders = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
    found: set[int] = set()
    for node in ast.walk(tree):
        if not isinstance(node, holders):
            continue
        first = node.body[0] if node.body else None
        if (
            isinstance(first, ast.Expr)
            and isinstance(first.value, ast.Constant)
            and isinstance(first.value.value, str)
        ):
            found.add(id(first.value))
    return found


def test_the_script_does_not_restate_the_control_repository_key_space() -> None:
    """Which four repositories exist is validated at one site, and the script is not it.

    `plan` owns the key space: `plan.py:175-176` is the single place the declared roots are
    differenced against `constants.CONTROL_REPOSITORIES`, and `build_runtime_wiring` re-raises
    that refusal as the typed `PrecheckAbort` the operator is owed. A second copy inside the
    entrypoint would not merely be duplication — it would be a second answer to the same
    question, free to drift from the first, and the drift would surface as an entrypoint that
    accepts or refuses a set of worktrees the library disagrees about. The script's whole job
    at this boundary is to read what was typed, not to know what may be typed.

    This is asserted over the source for the reason `:983` gives about the other AST guard: a
    duplicated check taken only on some path — say, only when four tokens were supplied —
    satisfies every behavioural test above, including
    `test_a_typed_precheck_abort_from_the_wiring_is_returned_as_the_hold_exit`, and is still
    a duplicated check. The behavioural test states what the script did on one invocation;
    this states what the script is able to do on any.

    Two spellings are refused. Reaching the constant by name is the direct one, and it is
    caught wherever it enters — an import alias, a bare `Name`, or an attribute read off a
    module handle — because all three end at the same tuple. `plan.SUITE_REPOSITORY` is
    refused alongside it: it is the same key space narrowed to one member, and the Suite root
    is the one that selects the allowed-signers file and the detached signature path, so a
    script that picked it out itself would be re-deciding the trust anchor that
    `test_the_injected_control_roots_are_the_exact_argv_tokens_the_plan_carries` binds to the
    plan. Restating the names as literals is the indirect spelling. At most one may appear,
    which is the deliberate width of this bound: a single name is what an honest `--help`
    example costs, while a key-space check needs the whole set and cannot be written with one.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    repositories = set(require_c8_attr(load_c8("constants"), "CONTROL_REPOSITORIES"))
    module = ast.parse(inspect.getsource(script))

    reached = (
        {node.id for node in ast.walk(module) if isinstance(node, ast.Name)}
        | {node.attr for node in ast.walk(module) if isinstance(node, ast.Attribute)}
        | {
            name
            for node in ast.walk(module)
            if isinstance(node, ast.Import | ast.ImportFrom)
            for alias in node.names
            for name in (alias.name.rsplit(".", 1)[-1], alias.asname)
            if name
        }
    )
    assert not reached & {"CONTROL_REPOSITORIES", "SUITE_REPOSITORY"}, (
        "the entrypoint may not reach for the key space the plan already validates"
    )

    documentation = docstring_constants(module)
    restated = sorted(
        {
            node.value
            for node in ast.walk(module)
            if isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and node.value in repositories
            and id(node) not in documentation
        }
    )
    assert len(restated) <= 1, (
        f"the entrypoint enumerates the control key space in code: {restated}"
    )


def test_main_default_execute_is_the_reviewed_composition_root() -> None:
    script = load_c8_script("run_topology_rehearsal.py")
    signature = inspect.signature(require_c8_attr(script, "main"))
    assert signature.parameters["execute"].default is require_c8_attr(
        script, "execute_authorized_attempt"
    )


def test_default_composition_loads_builds_and_runs_the_same_authorization() -> None:
    """One authorization, loaded once, built into one wiring and run once, in that order.

    The builder call is amended from `build(authorization=authorization)` to carry the roots
    the caller was handed. The one-keyword shape was the site of the defect: it described a
    composition root that could drive the *fake* builder here and never the real one, so the
    contradiction stayed invisible to every test taken alone.

    The order is asserted rather than just the set, and it still loads before it builds. That
    ordering is a residual risk carried deliberately: the grant and signature files are read
    before the roots are validated. Nothing spawns and no trust decision is taken in that
    window, but if `load_authorization` ever acquires a verification step the order must be
    revisited. `execute_requested` remains the fixed literal `True`, never derived from what
    was parsed, so a hold can never be turned into an execution by argv alone.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    execute = require_c8_attr(script, "execute_authorized_attempt")
    signature = inspect.signature(execute)
    assert signature.parameters["dependencies_loader"].default is require_c8_attr(
        script, "load_runtime_dependencies"
    )

    authorization = documents.authorization()
    adapters = object()
    wiring = SimpleNamespace(adapters=adapters)
    calls: list[tuple[object, ...]] = []

    def load(grant_path: str, signature_path: str):
        calls.append(("load", grant_path, signature_path))
        return authorization

    def build(*, authorization, repository_roots, attempt_ledger_root):
        calls.append(("build", authorization, repository_roots, attempt_ledger_root))
        return wiring

    def run(authorization, received_adapters, *, execute_requested: bool):
        calls.append(("run", authorization, received_adapters, execute_requested))
        return SimpleNamespace(outcome=fakes.TOPOLOGY_PASS)

    dependencies = SimpleNamespace(
        authorization_loader=load,
        wiring_builder=build,
        runner=run,
    )
    exit_code = execute(
        GRANT_PATH,
        SIGNATURE_PATH,
        repository_roots=fakes.SYNTHETIC_REPOSITORY_ROOTS,
        attempt_ledger_root=ATTEMPT_LEDGER_ROOT,
        dependencies_loader=lambda: dependencies,
    )
    assert exit_code == 0
    assert calls == [
        ("load", GRANT_PATH, SIGNATURE_PATH),
        ("build", authorization, fakes.SYNTHETIC_REPOSITORY_ROOTS, ATTEMPT_LEDGER_ROOT),
        ("run", authorization, adapters, True),
    ]


def test_the_control_roots_are_mandatory_at_the_composition_root_as_well() -> None:
    """The frame above the wiring must be mandatory too, or the mandate means nothing.

    This mirrors `test_the_control_roots_are_a_mandatory_keyword_argument_with_no_default`
    one frame up, and its absence is precisely what let the unsatisfiable contract land:
    `3cd9d77` made the roots mandatory at `build_runtime_wiring` and left
    `execute_authorized_attempt` on its prior two-positional shape, so nothing in the file
    stated that the two had to agree. A defaulted `repository_roots` here would restore the
    same defect in a quieter form — the composition root would answer for the operator, and
    whatever it answered would be a value nobody typed.

    The behavioural half matters as much as the signature: an invocation missing the roots
    must fail before the grant is read, so the refusal cannot be mistaken for a verdict about
    the artifacts. That is why the loader records and is then asserted untouched.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    execute = require_c8_attr(script, "execute_authorized_attempt")
    signature = inspect.signature(execute)
    parameter = signature.parameters["repository_roots"]
    assert parameter.kind is inspect.Parameter.KEYWORD_ONLY
    assert parameter.default is inspect.Parameter.empty
    widening = sorted(
        name
        for name, candidate in signature.parameters.items()
        if candidate.kind
        in (inspect.Parameter.VAR_KEYWORD, inspect.Parameter.VAR_POSITIONAL)
    )
    assert widening == [], "no variadic parameter may accept roots without naming them"

    loaded: list[tuple[str, str]] = []

    def load(grant_path: str, signature_path: str):
        loaded.append((grant_path, signature_path))
        return documents.authorization()

    dependencies = SimpleNamespace(
        authorization_loader=load,
        wiring_builder=lambda *, authorization, repository_roots: SimpleNamespace(
            adapters=object()
        ),
        runner=lambda *_args, **_kwargs: SimpleNamespace(outcome=fakes.TOPOLOGY_PASS),
    )
    with pytest.raises(TypeError):
        execute(
            GRANT_PATH,
            SIGNATURE_PATH,
            dependencies_loader=lambda: dependencies,
        )
    assert loaded == []


def test_default_dependency_loader_returns_the_reviewed_real_triple() -> None:
    script = load_c8_script("run_topology_rehearsal.py")
    runner = load_c8("runner")
    dependencies = require_c8_attr(script, "load_runtime_dependencies")()
    assert dependencies.authorization_loader is require_c8_attr(
        script, "load_authorization"
    )
    assert dependencies.wiring_builder is require_c8_attr(
        script, "build_runtime_wiring"
    )
    assert dependencies.runner is require_c8_attr(runner, "run_topology_rehearsal")


@pytest.mark.parametrize(
    "outcome",
    tuple(
        outcome
        for outcome in fakes.OUTCOME_PRECEDENCE
        if outcome != fakes.TOPOLOGY_PASS
    ),
)
def test_every_non_pass_result_maps_to_the_fixed_nonzero_hold_exit(outcome: str) -> None:
    script = load_c8_script("run_topology_rehearsal.py")
    authorization = documents.authorization()
    wiring = SimpleNamespace(adapters=object())
    dependencies = SimpleNamespace(
        authorization_loader=lambda _grant, _signature: authorization,
        wiring_builder=(
            lambda *, authorization, repository_roots, attempt_ledger_root: wiring
        ),
        runner=lambda _authorization, _adapters, *, execute_requested: SimpleNamespace(
            outcome=outcome
        ),
    )
    exit_code = require_c8_attr(script, "execute_authorized_attempt")(
        GRANT_PATH,
        SIGNATURE_PATH,
        repository_roots=fakes.SYNTHETIC_REPOSITORY_ROOTS,
        attempt_ledger_root=ATTEMPT_LEDGER_ROOT,
        dependencies_loader=lambda: dependencies,
    )
    assert exit_code == require_c8_attr(script, "HOLD_EXIT")
    assert exit_code != 0


@pytest.mark.parametrize("name", C8_SCRIPT_NAMES)
def test_entrypoint_surface_is_bounded(name: str) -> None:
    script = load_c8_script(name)
    expected = {"HOLD_EXIT", "build_parser", "main"}
    if name == "run_topology_rehearsal.py":
        # No control-root resolver is exported, and that absence is the contract. The four
        # worktrees the whole attempt is judged against arrive as `--control-root NAME=PATH`
        # tokens on the operator's own invocation and are forwarded, unmodified, through
        # `main` and `execute_authorized_attempt` into `build_runtime_wiring`, or the wiring
        # refuses. There is no host-observing second way to obtain them, so there is no
        # named resolver to review, nothing for a test to replace, and no invented absolute
        # path anywhere in `src/`. Carrying the injection up to argv adds no export either:
        # the two helpers that split what was typed, `_control_root_pair` and
        # `_control_roots`, are private and observe nothing, so this bound is unmoved. The
        # one bound that moved is the parser's.
        expected.update(
            {
                "SubprocessCommandRunner",
                "build_runtime_wiring",
                "execute_authorized_attempt",
            }
        )
    assert set(require_c8_attr(script, "__all__")) == expected


def test_the_only_process_executor_is_argv_only_shell_false_and_timeout_bounded() -> None:
    script = load_c8_script("run_topology_rehearsal.py")
    executor = require_c8_attr(script, "SubprocessCommandRunner")
    protocols = load_c8("protocols")
    assert isinstance(executor(), require_c8_attr(protocols, "CommandRunner"))
    signature = inspect.signature(executor.run)
    assert tuple(signature.parameters) == (
        "self",
        "argv",
        "timeout_seconds",
        "stdin",
    )
    assert signature.parameters["timeout_seconds"].kind is inspect.Parameter.KEYWORD_ONLY
    assert signature.parameters["stdin"].kind is inspect.Parameter.KEYWORD_ONLY
    tree = ast.parse(textwrap.dedent(inspect.getsource(executor.run)))
    spawns = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "subprocess"
    ]
    assert len(spawns) == 1, "exactly one process spawn may exist in the whole runner"
    spawn = spawns[0]
    assert spawn.func.attr == "run"
    keywords = {keyword.arg: keyword.value for keyword in spawn.keywords}
    assert isinstance(keywords["shell"], ast.Constant) and keywords["shell"].value is False
    assert (
        isinstance(keywords["capture_output"], ast.Constant)
        and keywords["capture_output"].value is True
    )
    assert isinstance(keywords["timeout"], ast.Name)
    assert keywords["timeout"].id == "timeout_seconds"
    assert isinstance(keywords["input"], ast.Name) and keywords["input"].id == "stdin"
    assert None not in keywords, "no **kwargs may widen the spawn"
    assert spawn.args, "argv must be passed positionally, never assembled as a string"
    argv_names = {
        node.id for node in ast.walk(spawn.args[0]) if isinstance(node, ast.Name)
    }
    assert "argv" in argv_names
    assert not [node for node in ast.walk(spawn.args[0]) if isinstance(node, ast.JoinedStr)]
    assert "join" not in {
        node.attr for node in ast.walk(spawn.args[0]) if isinstance(node, ast.Attribute)
    }


def test_the_declared_ceiling_is_clamped_at_the_spawn_site_and_not_merely_documented() -> None:
    """The 120s bound must be enforced in code, not just asserted in the class docstring.

    The single-spawn-site control above pins the spawn's `timeout` keyword to the *name*
    `timeout_seconds`, which a clamp that rebinds that name satisfies either way. So that
    control alone cannot tell an enforced ceiling from a deleted one: every adapter forwards
    `EFFECT_TIMEOUT_SECONDS = RUNTIME_LIMIT_SECONDS = 180`, and removing the clamp would
    silently restore the 180s effective bound with the whole file still green. This control
    is what makes the deletion visible.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    executor = require_c8_attr(script, "SubprocessCommandRunner")
    assert require_c8_attr(script, "COMMAND_TIMEOUT_SECONDS") == 120.0
    tree = ast.parse(textwrap.dedent(inspect.getsource(executor.run)))
    clamps = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign)
        and any(
            isinstance(target, ast.Name) and target.id == "timeout_seconds"
            for target in node.targets
        )
        and isinstance(node.value, ast.Call)
        and isinstance(node.value.func, ast.Name)
        and node.value.func.id == "min"
    ]
    assert len(clamps) == 1, "the ceiling must be applied exactly once, at the one spawn site"
    clamp = clamps[0]
    ceiling_names = {
        node.id for node in ast.walk(clamp.value) if isinstance(node, ast.Name)
    }
    assert "COMMAND_TIMEOUT_SECONDS" in ceiling_names, (
        "the clamp must bound against the declared per-executor ceiling, not a literal"
    )
    assert "timeout_seconds" in ceiling_names, "the caller's request must be the other bound"
    spawn = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "subprocess"
    )
    assert clamp.lineno < spawn.lineno, "the clamp must precede the spawn it bounds"


COMMAND_ADAPTER_NAMES = ("controls", "docker", "host", "probe", "signature")
# The concrete adapters that are not command adapters, and the protocol each must satisfy.
# Leaving any of them out of the wiring would let the runtime reach for a clock, a
# credential file or a ledger of its own, outside the one reviewed effect boundary.
RESOURCE_ADAPTER_PROTOCOLS = {
    "clock": ("MonotonicClock", "Clock"),
    "credential": ("CredentialFileAdapter", "CredentialPort"),
    "ledger": ("AtomicFileAttemptLedger", "AttemptLedger"),
}


class LedgerRunner:
    """A `CommandRunner` that answers every argv identically and records what it was asked.

    It exists so this file can prove the shared-executor property by *observation* — every
    command adapter's commands arriving at one object — rather than by asking each adapter to
    hand its runner back. See
    `test_no_public_adapter_attribute_hands_out_the_unguarded_process_executor` for why the
    difference matters.

    The scripted line is deliberately a single non-empty token. It resolves nothing: it is
    not a Git object id, not JSON and not two ephemeral bounds, so every decoder reading it
    returns its own unresolved value. That is what keeps this a routing test — it observes
    which argv reached the runner and never depends on what any adapter concluded.
    """

    UNRESOLVED_LINE = "unresolved"

    def __init__(self) -> None:
        self.argvs: list[tuple[str, ...]] = []

    def run(
        self,
        argv: Sequence[str],
        *,
        timeout_seconds: float,
        stdin: bytes | None = None,
    ):
        self.argvs.append(tuple(argv))
        return fakes.FakeCommandResult(returncode=0, stdout=f"{self.UNRESOLVED_LINE}\n")


def drive_command_adapter(name: str, wiring, signature_bytes: bytes) -> None:
    """Ask one command adapter for the cheapest read-only observation it owns.

    Every one of these is an observation, never a creation or a removal: nothing here can
    have an effect even if it reached a real host, and the injected runner means it cannot.
    Each call is made through the adapter's own reviewed method, so the commands that reach
    the runner are the ones the adapter would really issue.
    """
    adapter = wiring.command_adapters[name]
    if name == "controls":
        adapter.observe_controls()
    elif name == "host":
        adapter.observe_ephemeral_range()
    elif name == "docker":
        adapter.observe_platform()
    elif name == "probe":
        adapter.observe_digest(path=wiring.plan.probe_executable_path)
    elif name == "signature":
        adapter.verify(
            grant_bytes=documents.DEFAULT_GRANT_BYTES,
            signature_bytes=signature_bytes,
            signer=fakes.SIGNER,
            namespace=fakes.AUTHORIZATION_NAMESPACE,
        )
    else:  # pragma: no cover - a new command adapter must be driven here deliberately
        raise AssertionError(f"{name}: no reviewed read-only observation is driven for it")


def wiring_over_owned_suite_root(script, owned_root: Path, runner):
    """A wiring over roots this test owns, with its signature file written."""
    wiring = runtime_wiring(
        script,
        repository_roots=owned_suite_repository_roots(owned_root),
        command_runner=runner,
    )
    signature_file = Path(wiring.plan.signature_path)
    signature_file.parent.mkdir(parents=True, exist_ok=True)
    signature_file.write_bytes(documents.SIGNATURE_BYTES)
    return wiring


def test_runtime_wiring_builds_the_reviewed_plan_and_the_five_command_adapters() -> None:
    script = load_c8_script("run_topology_rehearsal.py")
    command_runner = LedgerRunner()
    wiring = runtime_wiring(script, command_runner=command_runner)
    assert wiring.command_runner is command_runner
    assert wiring.plan.commands == built_plan().commands
    assert tuple(wiring.command_adapters) == COMMAND_ADAPTER_NAMES
    # One plan object, shared by identity. The plan is inert reviewed data — a frozen
    # dataclass of argv tuples — so publishing it grants no authority to act, only the
    # ability to read what was already reviewed. `ExactCommandAdapter.plan` is the existing
    # precedent. A per-adapter plan would let two adapters disagree about which four
    # worktrees, which image and which container the one attempt is about.
    for name in COMMAND_ADAPTER_NAMES:
        assert wiring.command_adapters[name].plan is wiring.plan
    # Nothing was executed by building the wiring.
    assert command_runner.argvs == []


def test_every_command_adapter_routes_its_commands_through_the_one_injected_runner(
    tmp_path: Path,
) -> None:
    """One shared executor, proven by what the runner saw rather than by handing it out.

    A per-adapter runner would be a second process seam that no AST control over the single
    spawn site can see, so the wiring must be provably one-executor. The previous statement
    of this contract read `adapter.runner is command_runner` off each adapter, which forced
    every command adapter — including the five inside the frozen `Adapters` bundle — to
    publish the raw executor. That published an unguarded escape hatch: any holder of the
    bundle could call `adapters.docker.runner.run(argv, ...)` with *arbitrary* argv and walk
    straight past the plan-membership guard in `ExactCommandAdapter.run_effect`, which is the
    one check that keeps a reachable command inside the reviewed plan.

    The same property is stated here without that publication. Each adapter is asked for one
    read-only observation it already owns, and the injected runner's ledger is read: if all
    five adapters' commands arrive at the one object, they share it. This is strictly the
    stronger statement of the two — identity proves an adapter was *handed* the runner, while
    the ledger proves it actually *uses* it — and it hands the caller nothing.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    command_runner = LedgerRunner()
    wiring = wiring_over_owned_suite_root(script, tmp_path, command_runner)
    assert wiring.command_runner is command_runner

    planned = set(wiring.plan.commands.values())
    routed: dict[str, tuple[tuple[str, ...], ...]] = {}
    for name in COMMAND_ADAPTER_NAMES:
        already = len(command_runner.argvs)
        drive_command_adapter(name, wiring, documents.SIGNATURE_BYTES)
        routed[name] = tuple(command_runner.argvs[already:])

    # Every adapter reached the one runner, and every argv that arrived was a command of the
    # one plan — never something an adapter assembled for itself.
    silent = sorted(name for name, observed in routed.items() if not observed)
    assert silent == []
    unplanned = sorted(
        f"{name}: {argv}"
        for name, observed in routed.items()
        for argv in observed
        if argv not in planned
    )
    assert unplanned == []
    assert len(command_runner.argvs) == sum(len(observed) for observed in routed.values())
    # The controls adapter is the one that re-observes all four worktrees, so its routed argv
    # are also the exact witness that the injected roots survived the whole wiring.
    injected = owned_suite_repository_roots(tmp_path)
    for name in fakes.EXPECTED_CONTROLS:
        commit = wiring.plan.commands[f"control:{name}:commit"]
        assert commit in routed["controls"]
        assert control_root_argument(commit) == injected[name]


UNREADABLE = object()


def published_names(value: object) -> tuple[str, ...]:
    """Every public name reachable on `value`, over its own state and its type's MRO.

    `dir()` is deliberately not used: it is overridable through `__dir__`, so an adapter
    could hide a published attribute from exactly the check that looks for one. The
    instance's own `__dict__` and every class dictionary in the MRO are read directly
    instead, which sees a plain instance attribute, a `property` and a class attribute
    alike, and sees them wherever in the MRO they were defined — including on a shared
    accessor mixin, which is where the superseded `.runner` accessor lives today.

    `object`'s own surface is skipped because nothing an adapter authored is there.
    """
    names: list[str] = list(getattr(value, "__dict__", {}))
    for klass in type(value).__mro__:
        if klass is object:
            continue
        names.extend(vars(klass))
    return tuple(sorted({name for name in names if not name.startswith("_")}))


def read_published(holder: object, name: str) -> object:
    """One published attribute, read the way a caller holding the wiring would read it.

    A `property` is evaluated here rather than inspected as a descriptor, because a caller
    writes `adapter.runner`, not `type(adapter).runner.fget(adapter)`. An attribute whose
    read raises publishes nothing reachable, so it is reported as `UNREADABLE` and is not
    a finding; an attribute whose read *answers with the executor* is the finding.
    """
    try:
        return getattr(holder, name)
    except Exception:  # noqa: BLE001 -- an attribute that refuses to be read publishes nothing
        return UNREADABLE


def hands_out_the_executor(value: object, runner: object) -> bool:
    """True when `value` is the injected runner itself or one of its bound methods.

    Both spellings hand a caller the identical authority: `<published>.run(argv, ...)` and
    a directly published bound `<published>(argv, ...)` reach the same process seam. The
    second cannot be caught by identity on the attribute — a bound method is a fresh object
    on every read — so its `__self__` is compared instead. The `run` callable is what makes
    either one usable, which is why it is required rather than assumed.
    """
    if value is runner:
        return callable(getattr(value, "run", None))
    owner = getattr(value, "__self__", None)
    return owner is runner and callable(value)


def executor_publications(holder: object, runner: object) -> tuple[str, ...]:
    """Every published path on `holder` by which a caller can reach the injected runner.

    The walk is two levels deep on purpose. One level catches `adapter.runner`; the second
    catches an indirection such as `adapter.executor.runner`, which republishes the same
    seam behind one extra hop and would satisfy a one-level check while leaving
    `adapters.docker.executor.runner.run(argv, ...)` fully reachable. Paths are returned
    rather than a bare boolean so a failure names the attribute that has to be withdrawn.
    """
    found: list[str] = []
    for name in published_names(holder):
        value = read_published(holder, name)
        if value is UNREADABLE:
            continue
        if hands_out_the_executor(value, runner):
            found.append(name)
            continue
        for inner in published_names(value):
            nested = read_published(value, inner)
            if nested is not UNREADABLE and hands_out_the_executor(nested, runner):
                found.append(f"{name}.{inner}")
    return tuple(found)


def test_no_public_adapter_attribute_hands_out_the_unguarded_process_executor() -> None:
    """No command adapter publishes the raw process executor under any public name.

    `ExactCommandAdapter.run_effect` is the one check that keeps a reachable command inside
    the reviewed plan: it looks the effect up in `plan.commands` and runs that exact argv,
    so nothing outside the plan can be executed through it. That guard is only worth what
    the executor's reachability is worth. A command adapter that publishes the runner lets
    any holder of the wiring — or of the frozen `Adapters` bundle — call
    `adapters.docker.runner.run(argv, ...)` with *arbitrary* argv and step straight past it,
    and the single-spawn AST control in
    `test_the_only_process_executor_is_argv_only_shell_false_and_timeout_bounded` cannot see
    that, because the spawn site is unchanged; only who may reach it has changed.

    Superseded contract: commit `aae6a30` pinned `adapter.runner is command_runner` on every
    command adapter as the way to prove the wiring shares one executor. Independent review
    sustained that as a layering defect and it is withdrawn here. The shared-executor
    property it was proving is now proven behaviourally, and more strongly, by
    `test_every_command_adapter_routes_its_commands_through_the_one_injected_runner`:
    identity showed only that an adapter had been *handed* the runner, while the ledger
    shows every adapter actually *uses* it, and it hands the caller nothing.

    `.plan` publication remains permitted, and that is not an inconsistency. A
    `TopologyPlan` is inert reviewed data — a frozen dataclass of argv tuples — so reading
    it confers no authority to act, only the ability to read what was already reviewed;
    `ExactCommandAdapter.plan` is the existing precedent. The runner is the opposite kind of
    object: it is the authority to act, and publishing it is publishing that authority. So
    the plan identity is re-asserted below rather than merely tolerated.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    command_runner = LedgerRunner()
    wiring = runtime_wiring(script, command_runner=command_runner)
    assert wiring.command_runner is command_runner

    published = {
        name: executor_publications(wiring.command_adapters[name], command_runner)
        for name in COMMAND_ADAPTER_NAMES
    }
    assert {name: paths for name, paths in published.items() if paths} == {}
    # The inert half of the same contract, restated so the two are read together: the plan
    # is still one shared object, published by identity, on every one of the five adapters.
    for name in COMMAND_ADAPTER_NAMES:
        assert wiring.command_adapters[name].plan is wiring.plan
    # Reading every published attribute is itself inert. A publication that executed a
    # command merely to answer a read would be a worse defect than the one under test.
    assert command_runner.argvs == []


def test_the_injected_control_roots_are_the_exact_argv_tokens_the_plan_carries() -> None:
    """Accepting the argument is not enough: it must reach every planned observation.

    A wiring that took `repository_roots` and then resolved the host's own worktrees anyway
    would satisfy plan-shape assertions while planning against four repositories nobody
    named. So this reads the argv itself: each `git -C <root>` observation must be bound to
    exactly the worktree the caller injected, and no token anywhere in the plan may name the
    checkout these tests run from or an ancestor of it.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    wiring = runtime_wiring(script)
    for name, root in fakes.SYNTHETIC_REPOSITORY_ROOTS.items():
        for observation in ("commit", "tree", "status"):
            command = wiring.plan.commands[f"control:{name}:{observation}"]
            assert control_root_argument(command) == root
    # The Suite root is not only a `-C` argument: the reviewed signature verification names
    # the allowed-signers file and the detached signature underneath it, so an ignored
    # injection would also send `ssh-keygen` at a different worktree's trust material.
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    assert wiring.plan.signature_path.startswith(f"{suite_root}/")
    trespassers = sorted(
        f"{name}: {token}"
        for name, command in wiring.plan.commands.items()
        for token in command
        if names_this_checkout(token)
    )
    assert trespassers == []


def test_two_wirings_differing_only_in_their_injected_roots_build_two_different_plans(
    tmp_path: Path,
) -> None:
    """A wiring that ignored the injected roots cannot pass this.

    The previous test can be satisfied by a wiring that happens to agree with one set of
    roots. This one varies only `repository_roots` between two otherwise identical calls and
    requires the plan to follow: a constant, a host observation or an inlined fixture would
    produce the same commands twice and fail here regardless of what it produced.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    elsewhere = {
        name: str(tmp_path / name) for name in fakes.SYNTHETIC_REPOSITORY_ROOTS
    }
    first = runtime_wiring(script)
    second = runtime_wiring(script, repository_roots=elsewhere)
    assert first.plan.commands != second.plan.commands
    for name, root in elsewhere.items():
        for observation in ("commit", "tree", "status"):
            command = second.plan.commands[f"control:{name}:{observation}"]
            assert control_root_argument(command) == root
    assert second.plan.signature_path.startswith(f"{elsewhere[fakes.SUITE_CONTROL]}/")


def test_the_control_roots_are_a_mandatory_keyword_argument_with_no_default() -> None:
    """The caller must name the four worktrees, and no default may answer for them.

    Superseded contract: commit `82f0dd3` gave `repository_roots` a host-observing default,
    and the working tree that followed replaced that with an envelope field and a test
    asserting `"repository_roots" not in signature.parameters`. Both are withdrawn. Host
    observation is refuted on this host — the sibling-directory convention such a resolver
    would need resolves only `cybrik-suite`, so three of the four roots would have to be
    invented. The envelope is worse: the detached signature covers `grant_bytes` alone and
    `record_sha256` hashes nothing, so an envelope root would be an *unsigned* value, and
    `plan` builds the allowed-signers file and the detached signature path underneath the
    Suite root — an unsigned root therefore redirects the trust anchor of the very
    `ssh-keygen -Y verify` that checks the grant.

    The remaining honest answer is the one `plan.build_plan` already uses: a mandatory
    keyword-only argument, no default, supplied by the entrypoint from its own argv or
    config, at the same operator-declared trust level as `execute_requested=True` and the
    choice of authorization file. Both halves are asserted, because the default is what
    makes the difference: a parameter that exists but defaults would let a wiring handed no
    roots quietly plan against something nobody named, which is exactly the failure mode the
    refuted answers shared.

    A `**kwargs` is refused for the mirrored reason: a variadic would accept the roots
    without naming them, so the signature would stop being a readable statement of where the
    worktrees come from.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    build = require_c8_attr(script, "build_runtime_wiring")
    signature = inspect.signature(build)
    assert "authorization" in signature.parameters
    parameter = signature.parameters["repository_roots"]
    assert parameter.kind is inspect.Parameter.KEYWORD_ONLY
    assert parameter.default is inspect.Parameter.empty
    widening = sorted(
        name
        for name, parameter in signature.parameters.items()
        if parameter.kind
        in (inspect.Parameter.VAR_KEYWORD, inspect.Parameter.VAR_POSITIONAL)
    )
    assert widening == [], "no variadic parameter may accept roots without naming them"
    # The signature is the declaration; this is the behaviour. A wiring built with no roots
    # must fail to be built at all — never fall back to a host resolver, an envelope field
    # or a constant, all three of which would look identical to a caller from here.
    with pytest.raises(TypeError):
        build(authorization=documents.authorization())


# Every way an injected roots argument can fail to name exactly the four control worktrees,
# stated in the same shape `tests/test_preparation.py` states the `expected_controls`
# refusals: the argument unresolved, the argument carrying something that is not an
# inventory at all, the inventory not being the reviewed key space, and one root that is not
# a usable absolute separator-free worktree. `None` is the "supplied but unresolved" case:
# the parameter is mandatory, so the caller has to pass *something*, and passing nothing
# resolved is a refusal rather than a fallback.
MALFORMED_REPOSITORY_ROOTS = [
    pytest.param(None, id="unresolved"),
    pytest.param({}, id="empty"),
    pytest.param(
        dict(list(fakes.SYNTHETIC_REPOSITORY_ROOTS.items())[:3]),
        id="missing-one-repository",
    ),
    pytest.param(
        {
            **fakes.SYNTHETIC_REPOSITORY_ROOTS,
            "cybrik-extra": fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL],
        },
        id="extra-repository",
    ),
    pytest.param(
        {
            **fakes.SYNTHETIC_REPOSITORY_ROOTS,
            1: fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL],
        },
        id="extra-untyped-key",
    ),
    pytest.param(
        {**fakes.SYNTHETIC_REPOSITORY_ROOTS, fakes.SUITE_CONTROL: None},
        id="unread-root",
    ),
    pytest.param(
        {**fakes.SYNTHETIC_REPOSITORY_ROOTS, fakes.SOC_CONTROL: 0}, id="untyped-root"
    ),
    pytest.param(
        {**fakes.SYNTHETIC_REPOSITORY_ROOTS, fakes.AI_CONTROL: ""}, id="empty-root"
    ),
    pytest.param(
        {
            **fakes.SYNTHETIC_REPOSITORY_ROOTS,
            fakes.SOC_CONTROL: "cybrik-soc-command-center",
        },
        id="relative-root",
    ),
    pytest.param(
        {
            **fakes.SYNTHETIC_REPOSITORY_ROOTS,
            fakes.FABRIC_CONTROL: "/synthetic/cybrik-security-tool-fabric;rm",
        },
        id="separator-malformed-root",
    ),
    pytest.param(list(fakes.SYNTHETIC_REPOSITORY_ROOTS), id="sequence"),
    pytest.param(fakes.SUITE_CONTROL, id="string"),
    pytest.param(0, id="integer"),
]


@pytest.mark.parametrize("roots", MALFORMED_REPOSITORY_ROOTS)
def test_a_roots_argument_that_does_not_name_four_control_roots_is_refused(roots) -> None:
    """No fallback exists, so a malformed argument is a refusal and never a resolved value.

    Making the argument mandatory removes the only thing a wiring could have fallen back to,
    and that is the point: a caller that does not name the four worktrees has left nothing
    honest behind, because the sibling-directory convention a resolver would need resolves
    only `cybrik-suite` on a real checkout and would have to invent the other three, and the
    authorization envelope carries no signed root to read. So every malformed shape has to
    end the same way `expected_controls` already ends — one typed `PrecheckAbort` naming the
    parameter, before anything is built and before anything runs.

    `plan.build_plan` already refuses each of these shapes, but it refuses with `ValueError`
    and a `root:<repository>` label. The wiring is the boundary the operator is standing at,
    so it owes the operator the reviewed refusal type and the name of the argument that was
    wrong, not the internal label of whatever validated it.

    The injected ledger is read afterwards for the same reason `tests/test_preparation.py`
    asserts no forbidden effect was logged: a refusal that arrives *after* a process has been
    spawned is not a refusal, it is a report. Building the wiring is not authorized to
    execute anything even when the roots are well formed, and least of all when they are not.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    abort = require_c8_attr(load_c8("errors"), "PrecheckAbort")
    command_runner = LedgerRunner()
    with pytest.raises(abort) as refused:
        runtime_wiring(
            script,
            repository_roots=roots,
            command_runner=command_runner,
        )
    # A named refusal, not a bare classified stop: the operator is told which input failed.
    assert "repository_roots" in str(refused.value)
    assert command_runner.argvs == []


# The two envelope handles that carry the document under check. `grant` is the parsed
# document and `grant_bytes` is the same document serialized, so a root taken from either is
# the identical self-witnessing defect spelled two ways.
GRANT_ATTRIBUTES = frozenset({"grant", "grant_bytes"})
# Host observation that can never honestly name a control worktree. `argv` is deliberately
# absent from this set: the operator's `--control-root` tokens *are* argv, so argv is the one
# honest origin of a root, and banning it module-wide would forbid the very contract
# `test_the_control_roots_are_a_mandatory_keyword_argument_with_no_default` pins.
HOST_ROOT_SOURCES = frozenset({"environ", "getcwd", "cwd", "__file__"})
# The one keyword through which a root reaches a plan, and the shape of a name that holds one.
ROOT_KEYWORD = "repository_roots"
ROOT_NAMES = frozenset({"root", "roots"})
ROOT_NAME_SUFFIXES = ("_root", "_roots")


def name_reads(node: ast.AST) -> set[str]:
    """Every bare name referenced anywhere under `node`."""
    return {child.id for child in ast.walk(node) if isinstance(child, ast.Name)}


def getattr_calls(node: ast.AST) -> list[ast.Call]:
    return [
        child
        for child in ast.walk(node)
        if isinstance(child, ast.Call)
        and isinstance(child.func, ast.Name)
        and child.func.id == "getattr"
    ]


def literal_getattr_name(call: ast.Call) -> str | None:
    """The attribute a `getattr` reads, when it is spelled as a literal string."""
    if len(call.args) >= 2 and isinstance(call.args[1], ast.Constant):
        name = call.args[1].value
        if isinstance(name, str):
            return name
    return None


def attribute_reads(node: ast.AST) -> set[str]:
    """Every attribute read under `node`, counting `getattr(x, "n")` as a read of `n`.

    Normalising the dynamic form is what lets the blanket `getattr` ban be withdrawn without
    losing anything the ban actually caught. A name-based walk that cannot see
    `getattr(authorization, "repository_roots")` reads a dynamic read as no read at all,
    which is precisely the evasion the ban existed to stop — while the ban itself also
    forbade the reviewed idiom `preparation` uses to read `expected_controls` off the
    envelope, which is a legitimate read this wiring may need to make.
    """
    attributes = {
        child.attr for child in ast.walk(node) if isinstance(child, ast.Attribute)
    }
    named = {literal_getattr_name(call) for call in getattr_calls(node)}
    return attributes | {name for name in named if name is not None}


def computed_attribute_reads(node: ast.AST) -> list[int]:
    """The line of every `getattr` whose attribute name is not a literal string.

    A computed attribute name is unreviewable: no walk over this file can say which field it
    reaches, so it is refused outright rather than normalised. Together with
    `attribute_reads` this is equal-or-stronger than the blanket `getattr` ban it replaces —
    the dynamic spelling is still refused, and the literal spelling is now checked against
    the same forbidden names as the dotted one instead of being waved through.
    """
    return [
        call.lineno for call in getattr_calls(node) if literal_getattr_name(call) is None
    ]


def module_bindings(module: ast.AST) -> list[tuple[set[str], ast.AST]]:
    """Every `(names bound, expression bound from)` pair anywhere in the module.

    A `def` binds its own name to its whole body, and that is the edge a function-scoped
    guard structurally cannot follow: a module-level helper that reads the grant hands its
    caller a grant-derived value under a name that mentions neither the grant nor the read.
    """
    pairs: list[tuple[set[str], ast.AST]] = []
    for node in ast.walk(module):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            pairs.append(({node.name}, node))
        elif isinstance(node, ast.Assign):
            bound = {name for target in node.targets for name in name_reads(target)}
            pairs.append((bound, node.value))
        elif isinstance(node, ast.AnnAssign | ast.AugAssign | ast.NamedExpr):
            if node.value is not None:
                pairs.append((name_reads(node.target), node.value))
        elif isinstance(node, ast.For | ast.AsyncFor | ast.comprehension):
            pairs.append((name_reads(node.target), node.iter))
        elif isinstance(node, ast.withitem) and node.optional_vars is not None:
            pairs.append((name_reads(node.optional_vars), node.context_expr))
    return pairs


def call_parameter_bindings(module: ast.AST) -> list[tuple[set[str], ast.AST]]:
    """Every `(parameter bound, argument passed)` pair for calls to this module's own helpers.

    `module_bindings` follows taint only where a value acquires a *module* name. A parameter
    never acquires one, so a helper that returns its own parameter carries the grant across
    an edge that walk cannot see::

        def _wire(values): return plan.build_plan(repository_roots=values)
        ...  return _wire(_declared(authorization))

    The sink there reads `values` — a name bound nowhere in the module — and the derivation
    walk reports nothing, which is F22/F23's class respelled with one call. Pairing each
    parameter with the argument handed to it closes that edge and lets the existing fixed
    point do the rest: `values` enters `derived` because `_declared` is already in it.

    Deliberately conservative in three directions. A `*args`/`**kwargs` call site cannot be
    matched positionally, so every parameter of the callee is paired with the splatted value
    rather than none of them. Parameters are pooled by bare name across the module, so a
    parameter called `values` anywhere is derived once any `values` argument is. And a name
    may carry more than one `def` — a module helper and a method of a class, say — so *every*
    signature registered under a name is paired against the call and the pairs are unioned,
    rather than the last `def` seen by `ast.walk` silently replacing the others. Keying that
    table name-to-signature was F48: writing `class _Other: def _wire(self, ignored): ...`
    after a real `def _wire(values)` shadowed the real signature and disabled this whole edge
    for that name in one line. All three are over-approximations, which for a fail-closed
    guard is the safe direction; the shadowing shape is pinned as
    `EVADING_WIRING_SHAPES["shadowed-helper-signature"]`.

    The residual limit, stated as measured rather than as hoped: only a call whose callee is a
    literal `Name` matching a `def` in this module is followed. An attribute-spelled callee is
    not resolved here, and an earlier version of this docstring claimed such a callee "is
    caught by the module-name walk instead". Independent review MEASURED that claim FALSE.
    `_Wiring().wire(_declared(authorization))` is MISSED, and so is a `@staticmethod` reached
    as `_Wiring.wire(...)`; that is open finding F46 (attribute/method callees), NOT closed
    here. The alias case is only half true: `aliased-helper` in `EVADING_WIRING_SHAPES` is
    caught, but an alias *composed with* parameter laundering — `_alias = _wire` and then
    `_alias(_declared(authorization))` — was measured MISSED, because the alias target is
    never resolved to the aliased `def`'s signature. That is open finding F47, also NOT closed
    here. Open finding F45 is a third unmodelled binding edge in this same function: a
    parameter DEFAULT value binds that parameter, and defaults are not paired at all, so
    `def _wire(values=_declared(authorization))` carries taint past this walk. F45, F46 and
    F47 are all open against this file; nothing below fixes them. A call through a value
    obtained at runtime remains outside what any static walk over this file can claim.
    """
    functions: dict[str, list[ast.arguments]] = {}
    for node in ast.walk(module):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            functions.setdefault(node.name, []).append(node.args)
    pairs: list[tuple[set[str], ast.AST]] = []
    for node in ast.walk(module):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
            continue
        for signature in functions.get(node.func.id, ()):
            pairs.extend(argument_pairs(signature, node))
    return pairs


def argument_pairs(
    signature: ast.arguments, call: ast.Call
) -> list[tuple[set[str], ast.AST]]:
    """One call matched against one signature, splats included."""
    positional = signature.posonlyargs + signature.args
    every = {
        argument.arg
        for argument in positional + signature.kwonlyargs
        if argument is not None
    } | {
        argument.arg
        for argument in (signature.vararg, signature.kwarg)
        if argument is not None
    }
    pairs: list[tuple[set[str], ast.AST]] = []
    for index, value in enumerate(call.args):
        if isinstance(value, ast.Starred):
            pairs.append((every, value.value))
        elif index < len(positional):
            pairs.append(({positional[index].arg}, value))
        elif signature.vararg is not None:
            pairs.append(({signature.vararg.arg}, value))
    for keyword in call.keywords:
        if keyword.arg is None:
            pairs.append((every, keyword.value))
        elif keyword.arg in every:
            pairs.append(({keyword.arg}, keyword.value))
        elif signature.kwarg is not None:
            pairs.append(({signature.kwarg.arg}, keyword.value))
    return pairs


def grant_derived_names(module: ast.AST) -> set[str]:
    """Every name in the module that can hold something the grant or the host produced.

    A fixed point rather than a single pass, because the defect being caught is a read moved
    one level away from the function under review, and one level is not a bound: a helper
    calling a helper calling the envelope has to be followed to its end.

    Two binding edges, not one. `module_bindings` carries taint to names the module binds;
    `call_parameter_bindings` carries it across the call-argument-to-parameter edge, which
    holds no module name at all and so was invisible to the walk this docstring already
    claimed followed a helper "to its end". The parameter edge is used for derivation only
    and is kept out of `root_sinks`, so widening the walk cannot invent a new sink shape.
    """
    bindings = module_bindings(module) + call_parameter_bindings(module)
    derived: set[str] = set()
    while True:
        grown = {
            name
            for bound, value in bindings
            for name in bound
            if forbidden_origins(value) or name_reads(value) & derived
        }
        if grown <= derived:
            return derived
        derived |= grown


def forbidden_origins(node: ast.AST) -> set[str]:
    """The grant handles and host observations this expression reads directly."""
    return (name_reads(node) | attribute_reads(node)) & (
        GRANT_ATTRIBUTES | HOST_ROOT_SOURCES
    )


def root_sinks(module: ast.AST) -> list[ast.AST]:
    """Every expression through which a value becomes a control root.

    Four shapes, because a root can be named, splatted, keyed or held. The keyword is the one
    the plan actually reads; the root-shaped binding catches the value one step earlier, so a
    helper named `_control_roots` whose body reads the grant is an offence at its `def`
    rather than only at whatever eventually calls it.

    The two middle shapes are here because a literal keyword is not the only way to hand a
    plan its roots, and reading only the literal spelling lost a defect the withdrawn blanket
    `grant` ban had caught. `plan.build_plan(**arguments)` carries `keyword.arg is None`, so
    the sink disappears from a walk keyed on `ROOT_KEYWORD`, and the mapping that built it is
    bound to a name like `arguments` that no root-shaped test recognises either — the value
    launders in the gap between the two. A `**` value is therefore a sink wherever it appears,
    and so is any dict literal that keys `repository_roots`.

    That breadth is deliberate and it is not free: a splat carrying a grant-derived mapping is
    refused even when the root inside it is honest, because from outside the call this walk
    cannot tell the two apart. The honest spelling is to name the keyword, which the spec's
    own conforming shape already does.
    """
    calls = [node for node in ast.walk(module) if isinstance(node, ast.Call)]
    named = [
        keyword.value
        for node in calls
        for keyword in node.keywords
        if keyword.arg == ROOT_KEYWORD
    ]
    splatted = [
        keyword.value for node in calls for keyword in node.keywords if keyword.arg is None
    ]
    keyed = [
        node
        for node in ast.walk(module)
        if isinstance(node, ast.Dict)
        and any(
            isinstance(key, ast.Constant) and key.value == ROOT_KEYWORD for key in node.keys
        )
    ]
    held = [
        value
        for bound, value in module_bindings(module)
        for name in bound
        if name in ROOT_NAMES or name.endswith(ROOT_NAME_SUFFIXES)
    ]
    return named + splatted + keyed + held


def module_wide_offences(module: ast.AST) -> list[str]:
    """Every offence the module-wide root-derivation guard states over one wiring module.

    Stated as a function rather than inline in the test below so that the guard's own
    effectiveness proof runs the exact path the test runs. A proof that restated the walk
    would drift away from the walk silently, and a drifted proof is worse than none: it
    reports a control as exercised while exercising something else.

    Two offence classes, not one. A computed attribute name is refused outright wherever it
    sits — inside `build_runtime_wiring` or in any module helper it calls — because
    `literal_getattr_name` returns `None` for it, so `attribute_reads` records no read and
    the helper holding it never enters `derived`. Scoping that refusal to one function left
    `FIELD = "grant"` with `getattr(authorization, FIELD)` in a helper reaching a root with no
    read recorded anywhere, which is this file's own recorded evasion respelled in one extra
    line.
    """
    derived = grant_derived_names(module)
    offences = [
        f"line {line}: a control root may be reached under an unreadable attribute name"
        for line in computed_attribute_reads(module)
    ]
    for sink in root_sinks(module):
        reached = forbidden_origins(sink) | (name_reads(sink) & derived)
        if reached:
            offences.append(f"line {sink.lineno}: a control root derives from {sorted(reached)}")
    return sorted(offences)


def test_no_control_root_anywhere_in_the_wiring_module_derives_from_the_grant() -> None:
    """A root may not reach the plan from the document under check, at any depth.

    `test_the_wiring_never_reads_the_grant_or_the_host_for_a_control_root` below states this
    property over `inspect.getsource(build_runtime_wiring)` alone, and a function-scoped walk
    cannot state it at all. Two lines defeat it completely::

        def _roots(authorization): return authorization.grant["repositories"]
        ...  build_plan(..., repository_roots=_roots(authorization))

    That wiring is fully self-witnessing and every assertion in the function-scoped guard
    passes, because the banned bytes sit in a body the walk never opens. The same hole admits
    a module-level helper reading `os.environ` for a worktree path.

    The gap is not hypothetical, and closing it is what makes the wiring implementable at
    all. `test_runtime_wiring_builds_the_reviewed_plan_and_the_five_command_adapters` pins
    `wiring.plan.commands == built_plan().commands`, whose resource names embed
    `fakes.SYNTHETIC_ATTEMPT_ID`; the instant that produces it, `2026-08-05T00:00:00Z`,
    exists in the whole envelope only as `grant["observed_image_identity"]["observed_at"]`
    (`fakes.py:85`) and `grant["window"]["not_before"]` (`documents.py:44`), while
    `authorization.observed_at` is `00:01:00Z` (`documents.py:216`), `record["recorded_at"]`
    is `00:00:30Z` (`documents.py:47`) and `record["topology"]["image"]` carries no instant
    (`documents.py:143-144`). `SYNTHETIC_ATTEMPT_ID` is in `fakes.SYNTHETIC_VALUES`
    (`fakes.py:233`), so `test_no_synthetic_fixture_value_leaks_into_the_implementation`
    forbids inlining it. A blanket ban on the name `grant` therefore forced every
    implementation into exactly the module-level helper the blanket ban could not see. The
    ban is withdrawn and this test replaces it, stated over the property that was actually at
    stake: not whether the grant is read, but whether anything read from it reaches a *root*.

    Roots and the attempt identity are not symmetric, which is why one may come from the
    grant and the other may not. The attempt identity is a name the signed document is
    entitled to fix — it is what the one authorized attempt is *about*. A root is not: it
    selects the worktree whose commit is compared against the grant's own `repositories`
    pin, and `plan` derives the allowed-signers file and the detached signature path from
    the Suite root, so a grant-derived root would let the document under check choose both
    the evidence it is checked against and the key that checks it.

    `argv` is deliberately not a forbidden origin here. The operator's `--control-root`
    tokens *are* argv, so argv is the one honest source of a root; the wiring's own freedom
    from argv stays where it belongs, in the function-scoped guard below.

    Two respellings of the same defect were found passing this test after it first landed and
    are closed by `module_wide_offences` and `root_sinks` above: a computed `getattr` in a
    module helper, which recorded no attribute read at all, and a `**` splat, which erased the
    keyword the sink walk was keyed on. Neither is closed on assertion alone —
    `test_the_module_wide_root_derivation_guard_flags_each_recorded_evasion` runs both, and
    every other shape this walk claims to follow, through the exact path asserted here.

    What this test does *not* state is worth naming, because a guard trusted past its reach is
    worse than a narrow one. It follows taint through names that are *bound*, so a value
    mutated into an existing container in place, or returned from a method and read as an
    attribute rather than as a bare name, still passes; `HOST_ROOT_SOURCES` is an enumerated
    set, not the whole of host observation; and the anti-vacuity floor counts every sink shape
    rather than the named keyword specifically. Those are recorded as open findings against
    this file, not as properties it holds.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    require_c8_attr(script, "build_runtime_wiring")
    module = ast.parse(inspect.getsource(script))

    # Anti-vacuity. A module with no root sink would pass this test by saying nothing at all,
    # so the sinks are counted first: `main` names the roots to the wiring and the wiring
    # names them to `plan.build_plan`, which is two before any helper is counted.
    sinks = root_sinks(module)
    assert len(sinks) >= 2, "the injected roots must reach the plan through a named argument"

    assert module_wide_offences(module) == []


# The wiring shape the spec's obstacle-4 adjudication actually decided
# (`docs/ENTRYPOINT-SLICE-SPEC.md:377-388`): a repeatable `--control-root NAME=PATH` folded by
# two private helpers and forwarded as a mandatory keyword through to `build_runtime_wiring`,
# which reads the grant only for the attempt identity it is entitled to read. It is carried
# here as source rather than written to disk because nothing in this file may create the
# entrypoint it is waiting for. Its purpose is the other half of an AST control's honesty: a
# walk is only worth its false-negative reach if it is also known not to refuse the design it
# guards, and a guard that blocks the reviewed shape is a false blocker, not a control.
# The identity it hands the plan is rendered by `runner.attempt_id_for`, the package's one
# renderer of that string, and never spelled out here: `plan.build_plan` takes the rendered
# `attempt_id`, an `exact_token` that may not carry the `:` characters a raw ISO instant does,
# so a shape that forwarded the grant's instant verbatim would be a reference design whose
# first plan build refuses — and refuses after the single authorized attempt is already spent.
CONFORMING_WIRING_SHAPE = '''
import plan
from runner import attempt_id_for


def _control_root_pair(token):
    name, _, path = token.partition("=")
    return name, path


def _control_roots(tokens):
    return dict(_control_root_pair(token) for token in tokens)


def build_runtime_wiring(*, authorization, repository_roots):
    return plan.build_plan(
        repository_roots=repository_roots,
        attempt_id=attempt_id_for(
            authorization.grant["observed_image_identity"]["observed_at"]
        ),
    )


def main(argv=None):
    parsed = parse_arguments(argv)
    return execute_authorized_attempt(
        repository_roots=_control_roots(parsed.control_root),
    )
'''

# Every root-derivation shape the guard above claims to catch, each one written into the same
# module skeleton as the conforming shape so its honest sinks satisfy the anti-vacuity floor
# and the verdict is about the derivation rather than about the count. The first two were
# found passing this file's own guard by independent review after the guard landed; the rest
# are the reaches the guard was claimed to have, pinned so that a later narrowing of any
# helper cannot quietly give them back.
EVADING_WIRING_SHAPES = {
    # A computed attribute name, so `literal_getattr_name` yields nothing and the helper is
    # never recorded as reading anything at all.
    "computed-getattr-in-a-module-helper": '''
import plan

FIELD = "grant"


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def _roots(authorization):
    return getattr(authorization, FIELD)["repositories"]


def build_runtime_wiring(*, authorization, repository_roots):
    return plan.build_plan(repository_roots=_roots(authorization))


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # A `**` splat, so the literal keyword the sink walk was keyed on is not written anywhere,
    # and the mapping holding it is bound to a name that is not root-shaped.
    "splat-launders-the-keyword": '''
import plan


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def build_runtime_wiring(*, authorization, repository_roots):
    arguments = {"repository_roots": authorization.grant["repositories"]}
    return plan.build_plan(**arguments)


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # The recorded F3 evasion itself: the read moved one level out of the reviewed function.
    "module-level-grant-helper": '''
import plan


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def _roots(authorization):
    return authorization.grant["repositories"]


def build_runtime_wiring(*, authorization, repository_roots):
    return plan.build_plan(repository_roots=_roots(authorization))


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # One level is not a bound, so the fixed point is pinned against two.
    "two-hop-helper-chain": '''
import plan


def _envelope(authorization):
    return authorization.grant


def _roots(authorization):
    return _envelope(authorization)["repositories"]


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def build_runtime_wiring(*, authorization, repository_roots):
    return plan.build_plan(repository_roots=_roots(authorization))


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # The serialized handle is the same document, so it is the same defect.
    "grant-bytes-handle": '''
import json
import plan


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def build_runtime_wiring(*, authorization, repository_roots):
    parsed = json.loads(authorization.grant_bytes)
    return plan.build_plan(repository_roots=parsed["repositories"])


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # The host is the other forbidden origin, and it hides behind a helper just as well.
    "host-observing-helper": '''
import os
import plan


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def _here():
    return os.environ["CYBRIK_SUITE_ROOT"]


def build_runtime_wiring(*, authorization, repository_roots):
    return plan.build_plan(repository_roots=_here())


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # Tuple unpacking, so the binding that carries the taint is not a bare assignment.
    "tuple-unpacked-binding": '''
import plan


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def _split(authorization):
    return authorization.grant["repositories"], authorization.observed_at


def build_runtime_wiring(*, authorization, repository_roots):
    declared, _instant = _split(authorization)
    return plan.build_plan(repository_roots=declared)


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # An alias renames the helper but not what it reads.
    "aliased-helper": '''
import plan


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def _declared(authorization):
    return authorization.grant["repositories"]


_resolve = _declared


def build_runtime_wiring(*, authorization, repository_roots):
    return plan.build_plan(repository_roots=_resolve(authorization))


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # A comprehension binds its target too, so taint may not launder through iteration.
    "comprehension-bound-root": '''
import plan


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def build_runtime_wiring(*, authorization, repository_roots):
    declared_roots = [entry for entry in authorization.grant["repositories"]]
    return plan.build_plan(repository_roots=dict(declared_roots))


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # The sink names a parameter, and the taint enters that parameter as a call argument.
    "parameter-laundered-root": '''
import plan


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def _declared(authorization):
    return authorization.grant["repositories"]


def _wire(values):
    return plan.build_plan(repository_roots=values)


def build_runtime_wiring(*, authorization, repository_roots):
    return _wire(_declared(authorization))


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
    # The same parameter laundering, with one unrelated method of the same name written after
    # it. A signature table keyed name-to-signature is last-wins over `ast.walk`, so the later
    # `def _wire` replaces the real one and the call-argument-to-parameter edge for `_wire`
    # disappears entirely — a one-line evasion primitive against a fail-closed guard.
    "shadowed-helper-signature": '''
import plan


def _control_roots(tokens):
    return dict(token.partition("=")[::2] for token in tokens)


def _declared(authorization):
    return authorization.grant["repositories"]


def _wire(values):
    return plan.build_plan(repository_roots=values)


class _Other:
    def _wire(self, ignored):
        return ignored


def build_runtime_wiring(*, authorization, repository_roots):
    return _wire(_declared(authorization))


def main(argv=None):
    return execute_authorized_attempt(
        repository_roots=_control_roots(parse_arguments(argv).control_root),
    )
''',
}


def test_the_module_wide_root_derivation_guard_flags_each_recorded_evasion() -> None:
    """The guard is exercised against the shapes it claims to catch, not merely asserted.

    An AST control over a file that does not exist yet asserts nothing until that file is
    written, so between now and then its only evidence of reach is the set of shapes it has
    actually been run over. That evidence was missing when the guard landed, and two evasions
    of exactly the class it was written to close — a computed `getattr` in a module helper and
    a `**` splat around the sink keyword — were found passing it by independent review rather
    than by this file. Both are in the set below, so a repair that ever narrows `root_sinks`,
    `module_bindings`, `grant_derived_names` or `computed_attribute_reads` back to where they
    were fails here immediately instead of at the next review.

    The floor is asserted per shape before the offence is, so that a source which happens to
    be flagged only because it is too small to reach `len(sinks) >= 2` cannot be mistaken for
    a source the derivation walk caught. That mistake is easy to make and it inflates the
    guard's apparent reach, which is the failure this test exists to prevent.
    """
    for name, source in EVADING_WIRING_SHAPES.items():
        module = ast.parse(source)
        assert len(root_sinks(module)) >= 2, (
            f"{name}: this shape must be judged by the derivation walk, not by the floor"
        )
        assert module_wide_offences(module) != [], f"{name}: this evasion is not flagged"


def test_the_spec_conforming_wiring_shape_is_not_flagged_by_the_module_wide_guard() -> None:
    """The reviewed design must survive its own guard, or the guard is a false blocker.

    `docs/ENTRYPOINT-SLICE-SPEC.md:377-388` adjudicated the roots to the argv boundary and
    named the two private helpers that fold them. If the walk above refused that shape, this
    file would be demanding an implementation that cannot be written, and the demand would
    read exactly like a genuine finding — which is why the conforming shape is pinned here
    beside the evasions rather than left to a reviewer to re-derive.

    The grant read this shape *does* make is deliberate and must stay unflagged. The attempt
    identity is a name the signed document is entitled to fix; only a root may not come from
    it. A repair that flagged this source would have re-imposed the blanket ban the module
    docstring above withdraws, under a different name.
    """
    module = ast.parse(CONFORMING_WIRING_SHAPE)
    assert len(root_sinks(module)) >= 2
    assert module_wide_offences(module) == []


class RecordingAuthorization:
    """The real envelope, wrapped so every attribute read off it is recorded.

    `__getattr__` rather than `__getattribute__`, so the two handles this class needs for
    itself live in the instance dictionary and are never mistaken for a read the wiring
    performed. Everything else falls through and is both recorded and answered truthfully,
    which is what makes the recording a statement about the wiring rather than about a stub.
    """

    def __init__(self, envelope: object) -> None:
        self.__dict__["envelope"] = envelope
        self.__dict__["reads"] = []

    def __getattr__(self, name: str) -> object:
        self.__dict__["reads"].append(name)
        return getattr(self.__dict__["envelope"], name)


def test_the_wiring_never_reads_the_grant_or_the_host_for_a_control_root() -> None:
    """Neither the machine nor the envelope may name a root, and none is read at run time.

    This is the structural half of the contract the refusals above state behaviourally. A
    root read from the process environment, the working directory, `argv` or the wiring
    module's own location would make every command-plan assertion in this file a statement
    about the machine that happened to run it. And a root read off any attribute of the
    authorization would be an unsigned sidecar: the detached signature covers `grant_bytes`
    alone and `record_sha256` hashes nothing, so no field of that envelope is covered, while
    the Suite root selects the allowed-signers file and the detached signature path that
    `signature:verify` trusts.

    Reading the AST rather than the behaviour is what makes this exact: a wiring that
    consulted the host only when the injected roots were silent would satisfy every test
    above and still be host-derived on the one path that matters.

    Two enforcements this test used to carry have moved rather than gone. The blanket ban on
    the name `grant` is withdrawn and replaced by
    `test_no_control_root_anywhere_in_the_wiring_module_derives_from_the_grant`, which walks
    the whole module instead of this one function, follows helpers to a fixed point, and
    states the property that was actually at stake — no *root* derives from the grant —
    rather than banning a read the plan genuinely needs for the attempt identity and can
    obtain from nowhere else.

    That replacement was claimed here to be *strictly stronger*. The claim was false and is
    withdrawn. Independent review found one genuine defect the blanket ban caught and the
    replacement admitted: `arguments = {"repository_roots": authorization.grant[...]}`
    followed by `plan.build_plan(**arguments)`, where the literal keyword is never written and
    the mapping is bound to a name no root-shaped test recognises. `root_sinks` now reads a
    `**` value and a dict literal keying `repository_roots` as sinks, which closes that case
    and is pinned by `EVADING_WIRING_SHAPES["splat-launders-the-keyword"]`. It is still not
    restated as strictly stronger, because a walk over names and bindings cannot be a superset
    of a ban on bytes by construction: taint that leaves the set of bound names — mutated into
    an existing container in place, or returned from a method and read as an attribute rather
    than a bare `Name` — passes the replacement and did not pass the ban. Those are open
    findings against this file, not properties it holds.

    The blanket ban on `getattr` is withdrawn for the same reason it was too broad — it
    forbade the reviewed idiom `preparation` uses to read `expected_controls` off the
    envelope — and is replaced by two narrower controls: `attribute_reads` normalises
    `getattr(x, "n")` into an ordinary read of `n`, so every forbidden name below is now
    checked against the dynamic spelling too, and `computed_attribute_reads` refuses outright
    any `getattr` whose attribute name is not a literal a reviewer can read.

    Those two were claimed here to *between them lose nothing*. That claim was false as
    stated, and is withdrawn. It held inside this function only: the module-wide test never
    applied `computed_attribute_reads` at all, so `FIELD = "grant"` with
    `getattr(authorization, FIELD)` in a module helper reached a root with no read recorded
    anywhere, the dotted ban having been withdrawn and the dynamic one never reaching that
    far. `module_wide_offences` now states the same refusal over the whole module, pinned by
    `EVADING_WIRING_SHAPES["computed-getattr-in-a-module-helper"]`. What remains lost is
    narrower, and is named here rather than claimed away: `getattr_calls` matches only a bare
    `getattr`, so `builtins.getattr(x, name)` normalises to a read of `getattr` itself and
    yields no computed refusal, while `operator.attrgetter` and `vars(x)["grant"]` are not
    seen at all. The withdrawn ban did catch the first of those, textually. That is a real
    remaining loss, open against this file, and not a property either control holds.

    The recording envelope closes the last gap. The AST names what may not be written; the
    recording proves what was actually read, so a root reached through some third attribute
    nobody thought to forbid still fails here.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    build = require_c8_attr(script, "build_runtime_wiring")
    source = ast.parse(textwrap.dedent(inspect.getsource(build)))
    attributes = attribute_reads(source)
    referenced = name_reads(source) | attributes
    # The operator's own shell is not a source of anything this function derives.
    assert not referenced & {"getcwd", "cwd", "environ", "argv"}
    # No process may be spawned to find a root: the wiring runs before anything is
    # authorized to execute, so it must be structurally unable to need a spawn.
    assert not referenced & {"subprocess", "Popen", "system", "popen"}
    # Not even the reviewed file's own location. `__file__` was the anchor the withdrawn
    # host-observing default used, and its absence is what proves that default is gone.
    assert "__file__" not in referenced
    # No envelope field, read either by name or dynamically. The injected argument is the
    # whole of the derivation, so `repository_roots` may never appear as an attribute.
    assert "repository_roots" not in attributes
    # And no attribute may be reached under a name this file cannot read.
    assert computed_attribute_reads(source) == []

    # And nothing root-shaped is read off the authorization at run time either.
    envelope = RecordingAuthorization(documents.authorization())
    wiring = runtime_wiring(script, authorization=envelope)
    assert [name for name in envelope.__dict__["reads"] if "root" in name] == []
    for name, root in fakes.SYNTHETIC_REPOSITORY_ROOTS.items():
        command = wiring.plan.commands[f"control:{name}:commit"]
        assert control_root_argument(command) == root


def test_runtime_wiring_defaults_to_the_single_subprocess_executor() -> None:
    """The default execute path may not silently wire some other process seam.

    This pins the type of the default executor and nothing else. It used to also read
    `command_adapters[name].runner is wiring.command_runner`, which required every command
    adapter to publish the raw executor and so handed any holder of the wiring a way past
    the plan-membership guard in `ExactCommandAdapter.run_effect`. Its absence is enforced by
    `test_no_public_adapter_attribute_hands_out_the_unguarded_process_executor`.

    The *sharing* half of the withdrawn assertion is proven in two pieces, because the two
    paths differ. When the caller injects an executor,
    `test_every_command_adapter_routes_its_commands_through_the_one_injected_runner` proves
    all five adapters reach that one object. On this default path there is no injected object
    to observe, so the count is proven structurally by
    `test_the_default_execute_path_constructs_exactly_one_process_executor`.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    wiring = runtime_wiring(script)
    executor_type = require_c8_attr(script, "SubprocessCommandRunner")
    assert isinstance(wiring.command_runner, executor_type)


def test_the_default_execute_path_constructs_exactly_one_process_executor() -> None:
    """Exactly one executor object exists on the path an operator actually runs.

    The injected path is covered by the ledger of
    `test_every_command_adapter_routes_its_commands_through_the_one_injected_runner`, but that
    test hands `build_runtime_wiring` a `LedgerRunner` and so says nothing about what the
    default builds. Without this test a wiring that constructed a fresh
    `SubprocessCommandRunner` per adapter — five of them, plus a sixth published as
    `wiring.command_runner` — passes every test in this file: the single-spawn-site control in
    `test_the_only_process_executor_is_argv_only_shell_false_and_timeout_bounded` counts spawn
    *sites* in one class's source and is blind to how many instances of that class exist.

    Five executors would be five independent process seams. The argv-only, `shell=False` and
    timeout bounds are per-instance, so a later per-adapter executor could widen any of them
    with no test able to see the widening. The property is stated over the source rather than
    by reading `adapter.runner` off each adapter, because that read is exactly the publication
    `6bc0745` withdrew; asserting it structurally hands the caller nothing.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    builder = require_c8_attr(script, "build_runtime_wiring")

    def constructions(tree: ast.AST) -> list[ast.Call]:
        return [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "SubprocessCommandRunner"
        ]

    module = ast.parse(inspect.getsource(script))
    assert len(constructions(module)) == 1, (
        "the whole script may construct the process executor exactly once"
    )

    # And that one construction is the composition root's own. A per-adapter executor built
    # inside a private helper would keep the module count at one while running the call five
    # times, which is the shape this finding was raised against.
    builder_tree = ast.parse(textwrap.dedent(inspect.getsource(builder)))
    assert len(constructions(builder_tree)) == 1, (
        "the one construction must be `build_runtime_wiring`'s own, not a helper's"
    )

    # One call node is still not one object if it is evaluated more than once.
    repeated = (
        ast.For,
        ast.AsyncFor,
        ast.While,
        ast.ListComp,
        ast.SetComp,
        ast.DictComp,
        ast.GeneratorExp,
        ast.Lambda,
        ast.FunctionDef,
        ast.AsyncFunctionDef,
    )
    root = builder_tree.body[0]
    nested = [
        type(node).__name__
        for node in ast.walk(builder_tree)
        if isinstance(node, repeated) and node is not root and constructions(node)
    ]
    assert nested == [], "the executor may not be built inside a loop, comprehension or def"


def test_runtime_wiring_completes_the_injected_adapter_surface() -> None:
    script = load_c8_script("run_topology_rehearsal.py")
    adapter = load_c8("adapter")
    protocols = load_c8("protocols")
    wiring = runtime_wiring(script)
    assert isinstance(wiring.adapters, require_c8_attr(protocols, "Adapters"))
    assert wiring.adapters.identities is wiring.command_adapters["controls"]
    assert wiring.adapters.docker is wiring.command_adapters["docker"]
    assert wiring.adapters.host is wiring.command_adapters["host"]
    assert wiring.adapters.probe is wiring.command_adapters["probe"]
    assert wiring.adapters.verifier is wiring.command_adapters["signature"]
    for name, (adapter_name, protocol_name) in RESOURCE_ADAPTER_PROTOCOLS.items():
        concrete = getattr(wiring, name)
        assert isinstance(concrete, require_c8_attr(adapter, adapter_name))
        assert isinstance(concrete, require_c8_attr(protocols, protocol_name))
        assert getattr(wiring.adapters, name) is concrete


def test_the_ceiling_bounds_the_spawn_by_effect_not_by_syntactic_shape() -> None:
    """The clamp must be pinned by what reaches `subprocess.run`, not by how it is written.

    The sibling control above walks the AST for a single `timeout_seconds = min(...)`
    assignment. That shape test is satisfied by mutations that destroy the bound, and both
    are stated here as *appended* lines, because that is the reading in which they defeat it:
    `timeout_seconds *= 2` written below the clamp is an `AugAssign` and not an `Assign`, and
    `timeout_seconds = max(timeout_seconds, COMMAND_TIMEOUT_SECONDS)` written below it is an
    `Assign` whose call is not a `min`. Either leaves `len(clamps) == 1` and the whole file
    green while the effective bound becomes 240s -- the clamped 120s doubled, not the request
    doubled -- or 180s. As *replacements* neither is a hole: the `min` call disappears,
    `len(clamps)` becomes 0, and the sibling control catches them without help from this one.
    This control reads the value the seam actually hands the operating system, so no
    rewriting of the clamp can satisfy it without preserving the ceiling.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    executor = require_c8_attr(script, "SubprocessCommandRunner")()
    ceiling = require_c8_attr(script, "COMMAND_TIMEOUT_SECONDS")
    seen: list[float] = []

    def fake_run(argv, **kwargs):
        seen.append(kwargs["timeout"])
        raise OSError("no process is spawned by this control")

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(script.subprocess, "run", fake_run)
        # The exact value every adapter forwards, read from the constant rather than
        # transcribed: a hardcoded 180.0 asserted in prose that it equalled
        # `RUNTIME_LIMIT_SECONDS` while being free to drift away from it, and the drift would
        # have made this control pass against a request no adapter actually sends.
        forwarded = float(require_c8_attr(load_c8("constants"), "RUNTIME_LIMIT_SECONDS"))
        assert forwarded > ceiling, (
            "this control only pins a clamp while the forwarded request exceeds the ceiling"
        )
        executor.run(("/usr/bin/true",), timeout_seconds=forwarded)
        # A request already under the ceiling must pass through unchanged, so this control
        # pins a clamp and not a constant substitution.
        executor.run(("/usr/bin/true",), timeout_seconds=5.0)

    assert seen == [ceiling, 5.0], (
        "the spawn must receive min(request, COMMAND_TIMEOUT_SECONDS); an over-ceiling "
        "request must be bounded and an under-ceiling request must survive intact"
    )


def test_a_non_roots_plan_fault_keeps_the_boundary_it_came_from() -> None:
    """The prefix dispatch must route each `build_plan` ValueError to its true boundary.

    `build_plan` validates `attempt_id` and `image_reference` before it touches any root, so
    labelling those faults `repository_roots` told the operator to correct four worktrees that
    were correct. Deleting the `startswith` dispatch restores that misdirection with every
    other assertion in this file still green: the only refusal-text control that existed
    before this one is the roots-label check above, which the deleted branch still satisfies.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    abort = require_c8_attr(load_c8("errors"), "PrecheckAbort")
    # `plan` is imported inside `build_runtime_wiring`, so the name the dispatch resolves is
    # the package module's attribute rather than a script-level global.
    plan_module = load_c8("plan")

    def refuse(message: str):
        def build_plan(**kwargs):
            raise ValueError(message)

        return build_plan

    for detail in ("attempt_id: not a reviewed identifier", "image_reference: no digest"):
        with pytest.MonkeyPatch.context() as patch:
            patch.setattr(plan_module, "build_plan", refuse(detail))
            with pytest.raises(abort) as refused:
                runtime_wiring(script)
        text = str(refused.value)
        assert "plannable attempt" in text, (
            f"a {detail.split(':')[0]!r} fault is not a roots fault and must not be "
            "relabelled as one"
        )
        assert "repository_roots" not in text
        assert detail in text, "the originating boundary's own words must survive"

    # The complementary half: a fault that really is about the roots keeps the roots label.
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(
            plan_module, "build_plan", refuse("repository_roots: missing suite")
        )
        with pytest.raises(abort) as refused:
            runtime_wiring(script)
    assert "the four control worktrees were not named" in str(refused.value)


def recorded_ledger_paths(script, patch, **overrides) -> list[str]:
    """Every path the wiring hands the durable one-attempt ledger, in construction order.

    The path is read by recording the constructor argument rather than by reaching into the
    built object's private `_path`. A private attribute is not a contract: renaming it would
    silently turn this control green while the siting it pins went unobserved, which is the
    same reader-stops-looking failure the ledger already carries findings about.
    """
    adapter_module = load_c8("adapter")
    real = require_c8_attr(adapter_module, "AtomicFileAttemptLedger")
    seen: list[str] = []

    def recording(path: str):
        seen.append(path)
        return real(path)

    patch.setattr(adapter_module, "AtomicFileAttemptLedger", recording)
    runtime_wiring(script, **overrides)
    return seen


def test_the_attempt_ledger_is_sited_under_its_own_operator_named_root() -> None:
    """The one-attempt budget may not live under a worktree a re-checkout can replace.

    This is finding F0092. The budget was sited at `f"{plan.signature_path}.attempt-ledger"`,
    and `signature_path` is derived from the operator's `--control-root` for the suite, so
    the durable one-attempt guarantee was per *checkout* rather than per grant: a second
    clean checkout at the granted commit presented a fresh, unconsumed budget inside the same
    grant window. Admission pins every control worktree to `clean is True` plus an exact
    commit and tree, which is why an installed signing key fails there — but the ledger file
    is untracked, so a clean tree and the absence of a ledger are the same observation and
    nothing pinned it.

    The repair does not invent an anchor and reads no host source. It takes the ledger's
    worktree as a fifth operator declaration on argv, at the same trust level as `--execute`,
    the choice of grant file and the four `--control-root` tokens, and sites the budget
    there. What that buys is stated exactly by the second half of this test: moving the suite
    control root no longer moves the budget.

    The residual is disclosed rather than claimed away. An operator who deliberately types a
    *different* `--attempt-ledger-root` on a second invocation still gets a second budget.
    That is a different failure from the one F0092 names — it is a deliberate re-pointing by
    the holder of the grant, not a budget that resets as a side effect of ordinary checkout
    hygiene — and closing it needs an anchor no argv-only entrypoint can supply. Whether the
    remainder retires the row is the reviewer's call and is not decided here.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    with pytest.MonkeyPatch.context() as patch:
        sited = recorded_ledger_paths(script, patch)
    assert len(sited) == 1, "exactly one durable attempt ledger is constructed"
    ledger_path = sited[0]
    assert ledger_path.startswith(ATTEMPT_LEDGER_ROOT), (
        f"the budget must live under the declared ledger worktree, not at {ledger_path!r}"
    )
    for name, root in fakes.SYNTHETIC_REPOSITORY_ROOTS.items():
        assert not ledger_path.startswith(root), (
            f"the budget is sited under the {name!r} control root, so a second checkout of "
            "that worktree presents an unconsumed budget for the same grant (F0092)"
        )

    # The load-bearing half: the same grant and the same ledger declaration must yield the
    # same budget file even when the suite worktree is a different checkout entirely. A
    # siting that still reads the plan would move here and the paths would differ.
    moved = {**fakes.SYNTHETIC_REPOSITORY_ROOTS, fakes.SUITE_CONTROL: "/tmp/second-checkout"}
    with pytest.MonkeyPatch.context() as patch:
        resited = recorded_ledger_paths(script, patch, repository_roots=moved)
    assert resited == sited, (
        "re-checking-out the suite control worktree moved the one-attempt budget, which is "
        "exactly the reset F0092 names"
    )


def test_an_invocation_that_names_no_attempt_ledger_root_holds_without_calling_the_executor() -> None:
    """An unstated `--attempt-ledger-root` is refused in `main`, before anything is opened.

    Mandatory-ness is pinned where the operator observes it — a returned `HOLD_EXIT` and an
    empty call ledger — for the reason
    `test_an_invocation_that_names_no_control_root_holds_without_calling_the_executor`
    already gives about the four control roots: the shared-surface contract permits either
    argparse spelling, so asserting a `SystemExit` off the bare parser would forbid an honest
    implementation while proving nothing more about the exit code.

    The empty ledger is the load-bearing half. Without it a `main` that folded the unstated
    flag to a default of its own choosing and forwarded it would pass on the return code
    alone, and a defaulted ledger root is precisely the invented anchor this repair refuses
    to introduce.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    calls: list[tuple[object, ...]] = []
    exit_code = require_c8_attr(script, "main")(
        execute_argv(attempt_ledger_root=None), execute=recording_executor(calls)
    )
    assert exit_code == require_c8_attr(script, "HOLD_EXIT")
    assert exit_code != 0
    assert calls == [], (
        "an invocation that declared no ledger worktree may not reach the executor"
    )


def test_the_attempt_ledger_root_is_mandatory_at_both_frames_with_no_default() -> None:
    """Neither frame between the operator and the ledger may supply the worktree itself.

    Both frames, for the reason `test_the_control_roots_are_mandatory_at_the_composition_root_as_well`
    records: a mandate stated at one frame only is satisfied by the other frame inventing a
    value, and that is the defect being repaired rather than a new one.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    for name in ("build_runtime_wiring", "execute_authorized_attempt"):
        parameter = inspect.signature(
            require_c8_attr(script, name)
        ).parameters["attempt_ledger_root"]
        assert parameter.kind is inspect.Parameter.KEYWORD_ONLY, (
            f"{name}: the ledger worktree must be named at the call site, not positional"
        )
        assert parameter.default is inspect.Parameter.empty, (
            f"{name}: a default ledger worktree is an anchor nobody declared"
        )


def test_a_relative_attempt_ledger_root_holds_because_it_names_no_fixed_worktree() -> None:
    """A ledger worktree that is not absolute is answered by the process working directory.

    This is the first half of the carried F0092. Making the budget's worktree a fifth argv
    declaration moved it off `plan.signature_path`, but `main` only tested the token for
    truthiness, so a relative value resolved against whatever directory the operator happened
    to be standing in. The *identical* command line, run twice from two directories, then
    named two different files and produced two unconsumed budgets inside one grant window —
    which is the same reset F0092 names, reached by a different route. A checkout no longer
    moves the budget, but `cd` did.

    The refusal is stated at `main`, before anything is opened, because that is the frame the
    operator's typed token arrives at and the last one that can still answer with the hold
    exit rather than a file. The empty call ledger is the load-bearing half: a `main` that
    absolutised the value itself would pass on the return code alone, and choosing the base
    directory is exactly the anchor nobody declared.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    for relative in ("cybrik-attempt-ledger", "./ledger", "../ledger", "sub/dir"):
        calls: list[tuple[object, ...]] = []
        exit_code = require_c8_attr(script, "main")(
            execute_argv(attempt_ledger_root=relative),
            execute=recording_executor(calls),
        )
        assert exit_code == require_c8_attr(script, "HOLD_EXIT"), (
            f"a relative ledger worktree {relative!r} resolves against the process working "
            "directory, so the same command line run elsewhere gets a second budget (F0092)"
        )
        assert exit_code != 0
        assert calls == [], (
            f"the relative ledger worktree {relative!r} reached the executor"
        )


def test_an_attempt_ledger_root_inside_a_control_worktree_holds() -> None:
    """Naming a control worktree as the ledger root reproduces F0092 verbatim.

    The second half of the carried row. The separate declaration only buys anything while the
    two are disjoint: an operator who points `--attempt-ledger-root` at a worktree that is
    also under `--control-root` puts the budget straight back inside a directory a re-checkout
    replaces. Admission pins every control worktree to `clean is True` plus an exact commit
    and tree, and the ledger file is untracked, so a clean tree and an absent ledger remain
    the same observation — nothing downstream can see the difference, which is why the refusal
    has to be here.

    Exact equality and containment are both refused, and a merely adjacent path that shares a
    textual prefix is not: `/synthetic/suite-notes` is a different worktree from
    `/synthetic/suite`, and refusing it would be a control that fails on a name rather than on
    the containment that does the harm.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    for colliding in (suite_root, f"{suite_root}/ledger", f"{suite_root}/nested/deeper"):
        calls: list[tuple[object, ...]] = []
        exit_code = require_c8_attr(script, "main")(
            execute_argv(attempt_ledger_root=colliding),
            execute=recording_executor(calls),
        )
        assert exit_code == require_c8_attr(script, "HOLD_EXIT"), (
            f"the ledger worktree {colliding!r} lies inside a declared control worktree, so a "
            "second checkout of that worktree presents an unconsumed budget (F0092)"
        )
        assert calls == [], f"the colliding ledger worktree {colliding!r} reached the executor"

    # The control refuses containment, not a shared prefix. A sibling that merely starts with
    # the same characters is a distinct worktree and must still be accepted, or the repair
    # would be a string check wearing a siting control's name.
    adjacent: list[tuple[object, ...]] = []
    assert (
        require_c8_attr(script, "main")(
            execute_argv(attempt_ledger_root=f"{suite_root}-notes"),
            execute=recording_executor(adjacent),
        )
        == 0
    ), "a sibling worktree sharing a textual prefix is not inside the control worktree"
    assert len(adjacent) == 1


def test_the_attempt_ledger_root_is_held_to_the_argv_token_rule_the_control_roots_are() -> None:
    """The fifth declaration inherits the token discipline the other four never lost.

    `plan.control_commands` puts every control root through `plan.exact_token` and then
    requires it to be absolute; the ledger root was forwarded to an f-string with neither
    check, so the range *dropped* a validation the old siting inherited by construction from
    the plan. A token carrying a separator is the shape `exact_token` exists to refuse, and
    it must not become admissible merely by being typed after a different flag.

    The rule is read from `plan` rather than restated here, so a future widening of
    `FORBIDDEN_TOKEN_CHARACTERS` reaches this control without an edit.
    """
    from cybrik_suite_topology_rehearsal import plan

    script = load_c8_script("run_topology_rehearsal.py")
    for character in sorted(plan.FORBIDDEN_TOKEN_CHARACTERS):
        calls: list[tuple[object, ...]] = []
        exit_code = require_c8_attr(script, "main")(
            execute_argv(attempt_ledger_root=f"/tmp/ledger{character}rest"),
            execute=recording_executor(calls),
        )
        assert exit_code == require_c8_attr(script, "HOLD_EXIT"), (
            f"a ledger worktree carrying {character!r} is the shape exact_token refuses"
        )
        assert calls == [], f"a ledger worktree carrying {character!r} reached the executor"


def test_the_ledger_siting_rule_is_enforced_at_the_composition_root_as_well() -> None:
    """A siting rule stated only at the argv frame is satisfied by any other caller.

    The same argument `test_the_attempt_ledger_root_is_mandatory_at_both_frames_with_no_default`
    makes about mandatory-ness, and the one the loader guard inside
    `execute_authorized_attempt` records about its own contract: `build_runtime_wiring` is
    exported, so a relative or control-contained worktree that never passes through `main`
    would be sited without complaint. The refusal is the typed `PrecheckAbort` this frame
    already owes for a bad `repository_roots`, so both callers above it answer the operator
    with the hold exit rather than a traceback.

    Each rejected value is pinned to the reason it is rejected for (F0115). A bare
    `pytest.raises(PrecheckAbort)` is satisfied by any of the four other abort sites in
    `build_runtime_wiring`, so a change that made the synthetic roots or
    `documents.authorization()` stop satisfying `build_plan` would leave this control green
    while observing nothing at all about the siting rule.

    Naming the reason is still not enough on its own, because the same commit that introduced
    `plan.absolute_normal_path` made `build_runtime_wiring` render "must be absolute" and
    "normal form" into the *`repository_roots`* abort as well. Three of the five rows below
    could therefore be satisfied by a roots fault that observes nothing about the siting rule.
    Every row is anchored on the `attempt_ledger_root: ` prefix, which only the ledger frame
    emits, so the assertion pins both the frame that refused and what it refused for (F0115).
    """
    from cybrik_suite_topology_rehearsal.errors import PrecheckAbort

    script = load_c8_script("run_topology_rehearsal.py")
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    head, _, tail = suite_root.rpartition("/")
    rejected_for = (
        ("relative/ledger", "must be absolute"),
        (suite_root, "lies inside the .* control worktree"),
        (f"{suite_root}/nested", "lies inside the .* control worktree"),
        (f"{head}/{tail.upper()}/ledger", "lies inside the .* control worktree"),
        (f"{suite_root}/../other/ledger", "normal form"),
        ("//synthetic/ledger", "normal form"),
    )
    for rejected, reason in rejected_for:
        with pytest.raises(PrecheckAbort, match=f"attempt_ledger_root: .*{reason}"):
            runtime_wiring(script, attempt_ledger_root=rejected)


def test_a_precheck_abort_from_the_authorization_loader_holds_like_one_from_the_wiring() -> None:
    """Both typed refusals inside the composition root answer the operator the same way.

    This is finding F0098. The loader call sat outside the `try`, so a `PrecheckAbort` raised
    by `load_authorization` — which is the *default* loader's only behaviour in this slice —
    propagated out of `execute_authorized_attempt` as an exception, while the identical abort
    from `wiring_builder` two lines below returned `HOLD_EXIT`. The docstring promised to
    "hold on anything that is not a pass" for both.

    `main` catches `PrecheckAbort` and so masks the difference at the outermost frame, which
    is why no existing control saw this. That masking is exactly why the test is written
    against `execute_authorized_attempt` directly: the function states a contract of its own,
    it is exported in `__all__`, and a caller other than `main` gets a traceback where it was
    promised an exit code.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    abort = require_c8_attr(load_c8("errors"), "PrecheckAbort")
    reached: list[str] = []

    def refusing_loader(grant_path: str, signature_path: str):
        raise abort("load_authorization: not authorized in this slice")

    def build(*, authorization, repository_roots, attempt_ledger_root):
        reached.append("build")
        raise AssertionError("the wiring may not be reached after the loader refused")

    def run(authorization, received_adapters, *, execute_requested: bool):
        reached.append("run")
        raise AssertionError("the runner may not be reached after the loader refused")

    dependencies = SimpleNamespace(
        authorization_loader=refusing_loader, wiring_builder=build, runner=run
    )
    exit_code = require_c8_attr(script, "execute_authorized_attempt")(
        GRANT_PATH,
        SIGNATURE_PATH,
        repository_roots=fakes.SYNTHETIC_REPOSITORY_ROOTS,
        attempt_ledger_root=ATTEMPT_LEDGER_ROOT,
        dependencies_loader=lambda: dependencies,
    )
    assert exit_code == require_c8_attr(script, "HOLD_EXIT")
    assert exit_code != 0
    assert reached == [], "nothing below the loader may run once it has refused"


def test_a_non_normal_ledger_worktree_cannot_spell_its_way_inside_a_control_worktree() -> None:
    """INTENDED RED (F0092). Containment compared raw argv strings with no normal form.

    The carried row survived the move to a separate declaration because the comparison was
    textual on both sides while neither side was required to be in normal form. Three
    spellings name a directory *inside* the suite control worktree and compare unequal to
    every declared root, so all three were accepted on a single command line, typed once,
    with no re-pointing — this is not the residual the module disclosed.

    `//synthetic/...` is listed because `posixpath.normpath` preserves two leading slashes,
    so it defeats a normal-form check that only compares against `normpath`.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    head, _, tail = suite_root.rpartition("/")
    evasions = (
        f"{head}/./{tail}/ledger",
        f"/{suite_root}",
        f"{head}/{tail}/../{tail}/ledger",
        f"{head}//{tail}/ledger",
    )
    for evasion in evasions:
        calls: list[tuple[object, ...]] = []
        exit_code = require_c8_attr(script, "main")(
            execute_argv(attempt_ledger_root=evasion),
            execute=recording_executor(calls),
        )
        assert exit_code == require_c8_attr(script, "HOLD_EXIT"), (
            f"the ledger worktree {evasion!r} is a non-normal spelling of a directory inside "
            "a declared control worktree, so a second checkout of that worktree presents an "
            "unconsumed budget (F0092)"
        )
        assert calls == [], f"the evading ledger worktree {evasion!r} reached the executor"


def test_a_non_normal_control_worktree_cannot_hide_a_plainly_spelled_ledger_root() -> None:
    """INTENDED RED (F0092). The other side of the same comparison.

    `control_commands` required only absoluteness, so an operator could type the *control*
    root non-normally and leave the ledger root spelled plainly: the two strings then differ,
    containment is not seen, and the budget again sits under a directory a re-checkout
    replaces. Fixing only the ledger side would leave the row live through this route, which
    is why the rule is enforced where control roots are validated as well.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    head, _, tail = suite_root.rpartition("/")
    calls: list[tuple[object, ...]] = []
    exit_code = require_c8_attr(script, "main")(
        execute_argv(
            {**fakes.SYNTHETIC_REPOSITORY_ROOTS, fakes.SUITE_CONTROL: f"{head}/./{tail}"},
            attempt_ledger_root=f"{suite_root}/ledger",
        ),
        execute=recording_executor(calls),
    )
    assert exit_code == require_c8_attr(script, "HOLD_EXIT"), (
        "a non-normal control worktree must be refused where control roots are validated, or "
        "it hides a plainly-spelled ledger root sited inside it (F0092)"
    )
    assert calls == [], "the non-normal control worktree reached the executor"


def test_a_case_variant_ledger_worktree_cannot_alias_into_a_control_worktree() -> None:
    """INTENDED RED (F0092). Normal form fixed the spelling, not the aliasing.

    The seventh carry. Requiring a normal form on both sides made every *punctuation* respelling
    of one directory compare equal, but the comparison stayed byte-exact, and byte-exactness is
    not what "the same directory" means on the filesystems these worktrees actually live on.
    macOS APFS is case-insensitive by default, so a ledger worktree whose only difference from a
    declared control worktree is the case of a component names that directory at `os.open` while
    comparing unequal to every declared root. Every token below passes `exact_token`, the
    absoluteness check and the normal-form check untouched.

    This is the shape the module disclosure does not cover and cannot be argued away as
    deliberate re-pointing: one command line, typed once, with ordinary spellings and no
    filesystem object created for the purpose. The budget lands back inside a worktree that a
    re-checkout replaces, which is F0092 verbatim.

    Case folding is refused in the *comparison* only. The operator's token is still forwarded
    exactly as typed, because rewriting it would make this file choose a directory nobody named.
    On a case-sensitive filesystem the fold refuses a handful of genuinely distinct worktrees;
    that is the fail-closed direction and costs the operator one retype, whereas the converse
    hands back the budget reset the control exists to prevent.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    head, _, tail = suite_root.rpartition("/")
    aliases = (
        f"{head}/{tail.upper()}/ledger",
        f"{head}/{tail.capitalize()}/ledger",
        f"{head}/{tail.upper()}",
    )
    for alias in aliases:
        calls: list[tuple[object, ...]] = []
        exit_code = require_c8_attr(script, "main")(
            execute_argv(attempt_ledger_root=alias),
            execute=recording_executor(calls),
        )
        assert exit_code == require_c8_attr(script, "HOLD_EXIT"), (
            f"the ledger worktree {alias!r} differs from a declared control worktree only in "
            "case, so on a case-insensitive filesystem it names that worktree and a second "
            "checkout of it presents an unconsumed budget (F0092)"
        )
        assert calls == [], f"the case-aliasing ledger worktree {alias!r} reached the executor"


def test_a_case_variant_control_worktree_cannot_hide_a_plainly_spelled_ledger_root() -> None:
    """INTENDED RED (F0092). The other side of the same aliasing.

    Symmetric to `test_a_non_normal_control_worktree_cannot_hide_a_plainly_spelled_ledger_root`.
    Folding only the ledger token would leave the row live through the control token, since the
    operator chooses the spelling of both and the comparison is the same one.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    head, _, tail = suite_root.rpartition("/")
    calls: list[tuple[object, ...]] = []
    exit_code = require_c8_attr(script, "main")(
        execute_argv(
            {**fakes.SYNTHETIC_REPOSITORY_ROOTS, fakes.SUITE_CONTROL: f"{head}/{tail.upper()}"},
            attempt_ledger_root=f"{suite_root}/ledger",
        ),
        execute=recording_executor(calls),
    )
    assert exit_code == require_c8_attr(script, "HOLD_EXIT"), (
        "a control worktree differing only in case must be refused where the containment is "
        "decided, or it hides a plainly-spelled ledger root sited inside it (F0092)"
    )
    assert calls == [], "the case-aliasing control worktree reached the executor"


def test_a_normalization_variant_ledger_worktree_cannot_alias_into_a_control_worktree() -> None:
    """INTENDED RED (F0092, eighth carry). Case folding does not fold Unicode normalization.

    `casefold` answers spelling-by-case. It does not answer spelling-by-*normal form*: U+00E9
    (precomposed `e-acute`) and U+0065 U+0301 (`e` plus combining acute) are canonically
    equivalent, casefold to themselves, and compare unequal. Nothing upstream closes the gap --
    `plan.exact_token` constrains separators and emptiness rather than the character repertoire,
    and `os.path.normpath`, which the plan's normal-form check rests on, normalizes *path
    punctuation* and never Unicode. So an operator who declares
    `--control-root cybrik-suite=/synthetic/café-suite` and
    `--attempt-ledger-root /synthetic/café-suite/ledger` passes every existing check,
    compares unequal to every declared root, and reaches that same control worktree at
    `os.open` on the case-insensitive volumes the case repair's own argument depends on.

    This is the identical shape as the case variant and not the disclosed residual: one command
    line, typed once, two ordinary spellings, no filesystem object created for the purpose. It
    is graded a defect for the same reason the case variant was.

    Both directions are driven, because the operator chooses the spelling of both tokens, and
    the fourth row crosses normalization with case: a fold applied in the wrong order, or on one
    side only, leaves at least one row live.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    precomposed = "/synthetic/café-suite"
    decomposed = "/synthetic/café-suite"
    assert precomposed != decomposed, "the two spellings must differ as strings to prove anything"

    rows = (
        (precomposed, f"{decomposed}/ledger"),
        (decomposed, f"{precomposed}/ledger"),
        (precomposed, decomposed),
        (precomposed, f"{decomposed.upper()}/ledger"),
    )
    for declared, alias in rows:
        calls: list[tuple[object, ...]] = []
        exit_code = require_c8_attr(script, "main")(
            execute_argv(
                {**fakes.SYNTHETIC_REPOSITORY_ROOTS, fakes.SUITE_CONTROL: declared},
                attempt_ledger_root=alias,
            ),
            execute=recording_executor(calls),
        )
        assert exit_code == require_c8_attr(script, "HOLD_EXIT"), (
            f"the ledger worktree {alias!r} is a normalization variant of the declared control "
            f"worktree {declared!r}, so it names that worktree at os.open and a second checkout "
            "of it presents an unconsumed budget (F0092)"
        )
        assert calls == [], (
            f"the normalization-aliasing ledger worktree {alias!r} reached the executor"
        )


def test_the_containment_fold_is_canonical_and_not_merely_case_insensitive() -> None:
    """INTENDED RED (F0092). Pins the *order* of the fold, which the aliasing rows cannot see.

    Normalizing only after folding is the plausible wrong cut and it is wrong for a documented
    reason: casefolding is not closed under normalization. UAX#15 D145 defines the canonical
    caseless form with a normalization on *both* sides of the fold precisely because U+0345
    (combining Greek ypogegrammeni) casefolds into a character that then recomposes differently
    depending on whether its input was already normalized. Folding first and normalizing once
    therefore maps canonically-equivalent inputs to different results.

    The inner normalization is what makes the guarantee provable rather than measured: it makes
    canonically-equivalent inputs *byte-identical* before anything else runs, so every later
    step is deterministic on them. Asserting that here stops a future simplification to the
    one-sided form, which the four aliasing rows above would not catch.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    fold = require_c8_attr(script, "_canonical_caseless")
    witness = "́ͅ"
    assert fold(witness) == fold(unicodedata.normalize("NFC", witness)), (
        "canonically equivalent tokens must fold to one value; normalizing only after the "
        "casefold leaves U+0345 mapping equivalent inputs apart (UAX#15 D145)"
    )
    assert fold("café") == fold("café"), "the fold must answer normal form"
    assert fold("CAFÉ") == fold("café"), "the fold must still answer case"


def test_a_control_worktree_naming_the_filesystem_root_refuses_every_ledger_worktree() -> None:
    """INTENDED RED (F0092). A fail-open regression introduced by the normal-form repair.

    The containment test builds its prefix as `enclosing + "/"`. For every ordinary worktree
    that is right, because a normal-form path never carries a trailing separator. `/` is the one
    normal-form path that is itself the separator, so the prefix became `//` and matched nothing:
    a control root of `/` accepted every absolute ledger worktree, when `/` encloses all of them
    and must refuse all of them.

    The superseded `rstrip`-based loop happened to answer this correctly -- it made `enclosing`
    empty, and every absolute token starts with the empty string -- so the repair that closed the
    non-normal spellings moved this case from fail-closed to fail-open. That direction is what
    the ledger bans outright, independently of how reachable the case is, which is why it is
    pinned here rather than disclosed.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    suite_root = fakes.SYNTHETIC_REPOSITORY_ROOTS[fakes.SUITE_CONTROL]
    for ledger in (f"{suite_root}-notes", "/ledger", f"{suite_root}/ledger"):
        calls: list[tuple[object, ...]] = []
        exit_code = require_c8_attr(script, "main")(
            execute_argv(
                {**fakes.SYNTHETIC_REPOSITORY_ROOTS, fakes.SUITE_CONTROL: "/"},
                attempt_ledger_root=ledger,
            ),
            execute=recording_executor(calls),
        )
        assert exit_code == require_c8_attr(script, "HOLD_EXIT"), (
            f"a control worktree of '/' encloses the ledger worktree {ledger!r}, so it must be "
            "refused; accepting it is the fail-open direction (F0092)"
        )
        assert calls == [], f"the ledger worktree {ledger!r} under a '/' control root ran"
