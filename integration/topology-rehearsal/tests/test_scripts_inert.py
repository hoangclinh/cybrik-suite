"""The two operator entrypoints are inert unless exact explicit flags are supplied."""

from __future__ import annotations

import ast
import inspect
import sys
import textwrap
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


def execute_argv(roots: Mapping[str, str] | None = None) -> list[str]:
    """One complete authorized invocation: the two artifact paths and the control roots."""
    named = fakes.SYNTHETIC_REPOSITORY_ROOTS if roots is None else roots
    return [
        "--execute",
        "--grant",
        GRANT_PATH,
        "--signature",
        SIGNATURE_PATH,
        *control_root_flags(named),
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

    def execute(grant_path: str, signature_path: str, *, repository_roots) -> int:
        calls.append((grant_path, signature_path, repository_roots))
        return 0

    exit_code = require_c8_attr(script, "main")(execute_argv(), execute=execute)
    assert exit_code == 0
    assert calls == [
        (GRANT_PATH, SIGNATURE_PATH, dict(fakes.SYNTHETIC_REPOSITORY_ROOTS))
    ]


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

    def build(*, authorization, repository_roots):
        calls.append(("build", authorization, repository_roots))
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
        dependencies_loader=lambda: dependencies,
    )
    assert exit_code == 0
    assert calls == [
        ("load", GRANT_PATH, SIGNATURE_PATH),
        ("build", authorization, fakes.SYNTHETIC_REPOSITORY_ROOTS),
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
        wiring_builder=lambda *, authorization, repository_roots: wiring,
        runner=lambda _authorization, _adapters, *, execute_requested: SimpleNamespace(
            outcome=outcome
        ),
    )
    exit_code = require_c8_attr(script, "execute_authorized_attempt")(
        GRANT_PATH,
        SIGNATURE_PATH,
        repository_roots=fakes.SYNTHETIC_REPOSITORY_ROOTS,
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
    """Neither the document under check, nor the machine, nor the envelope may name a root.

    This is the structural half of the contract the refusals above state behaviourally. A
    root copied out of `authorization.grant` would make the whole control observation
    self-witnessing — the document being verified would choose the worktree its own claims
    are checked against, which is exactly the boundary Admission commit `1050684`
    established. A root read from the process environment, the working directory, `argv` or
    the wiring module's own location would make every command-plan assertion in this file a
    statement about the machine that happened to run it. And a root read off any other
    attribute of the authorization would be an unsigned sidecar: the detached signature
    covers `grant_bytes` alone and `record_sha256` hashes nothing, so no field of that
    envelope is covered, while the Suite root selects the allowed-signers file and the
    detached signature path that `signature:verify` trusts.

    Reading the AST rather than the behaviour is what makes this exact: a wiring that
    consulted the grant only when the injected roots were silent would satisfy every test
    above and still be self-witnessing on the one path that matters. `getattr` is refused
    alongside the literal names because a dynamic read is the same defect spelled so that a
    name-based walk cannot see it — and it is precisely the idiom `preparation` uses to read
    `expected_controls` off the envelope. The AST-walk idiom is the one the withdrawn
    resolver test used; only its subject was wrong, because there is no resolver left to
    review and `build_runtime_wiring` itself is now the whole of the derivation.

    The recording envelope closes the last gap. The AST names what may not be written; the
    recording proves what was actually read, so a root reached through some third attribute
    nobody thought to forbid still fails here.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    build = require_c8_attr(script, "build_runtime_wiring")
    source = ast.parse(textwrap.dedent(inspect.getsource(build)))
    attributes = {
        node.attr for node in ast.walk(source) if isinstance(node, ast.Attribute)
    }
    referenced = {
        node.id for node in ast.walk(source) if isinstance(node, ast.Name)
    } | attributes
    # The document under check is not a source, and neither is the operator's own shell.
    assert not referenced & {"grant", "getcwd", "cwd", "environ", "argv"}
    # No process may be spawned to find a root: the wiring runs before anything is
    # authorized to execute, so it must be structurally unable to need a spawn.
    assert not referenced & {"subprocess", "Popen", "system", "popen"}
    # Not even the reviewed file's own location. `__file__` was the anchor the withdrawn
    # host-observing default used, and its absence is what proves that default is gone.
    assert "__file__" not in referenced
    # No envelope field, read either by name or dynamically. The injected argument is the
    # whole of the derivation, so `repository_roots` may never appear as an attribute.
    assert "repository_roots" not in attributes
    assert "getattr" not in referenced

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
    the plan-membership guard in `ExactCommandAdapter.run_effect`. That property is proven
    without the publication by
    `test_every_command_adapter_routes_its_commands_through_the_one_injected_runner`, and its
    absence is enforced by
    `test_no_public_adapter_attribute_hands_out_the_unguarded_process_executor`.
    """
    script = load_c8_script("run_topology_rehearsal.py")
    wiring = runtime_wiring(script)
    executor_type = require_c8_attr(script, "SubprocessCommandRunner")
    assert isinstance(wiring.command_runner, executor_type)


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
