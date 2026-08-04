"""The two operator entrypoints are inert unless exact explicit flags are supplied."""

from __future__ import annotations

import ast
import sys
import inspect
import textwrap
from types import SimpleNamespace

import pytest

import fakes
import documents
from conftest import C8_SCRIPT_NAMES, PACKAGE, load_c8, load_c8_script, require_c8_attr


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


def runtime_wiring(script, **overrides):
    return require_c8_attr(script, "build_runtime_wiring")(
        authorization=documents.authorization(),
        **overrides,
    )


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
    script = load_c8_script("run_topology_rehearsal.py")
    parser = require_c8_attr(script, "build_parser")()
    args = parser.parse_args(
        [
            "--execute",
            "--grant",
            "/tmp/grant.json",
            "--signature",
            "/tmp/grant.json.sig",
        ]
    )
    assert args.execute is True
    assert args.grant == "/tmp/grant.json"
    assert args.signature == "/tmp/grant.json.sig"


def test_exact_execute_path_calls_one_injected_executor_with_external_paths() -> None:
    script = load_c8_script("run_topology_rehearsal.py")
    calls: list[tuple[str, str]] = []

    def execute(grant_path: str, signature_path: str) -> int:
        calls.append((grant_path, signature_path))
        return 0

    exit_code = require_c8_attr(script, "main")(
        [
            "--execute",
            "--grant",
            "/tmp/grant.json",
            "--signature",
            "/tmp/grant.json.sig",
        ],
        execute=execute,
    )
    assert exit_code == 0
    assert calls == [("/tmp/grant.json", "/tmp/grant.json.sig")]


def test_main_default_execute_is_the_reviewed_composition_root() -> None:
    script = load_c8_script("run_topology_rehearsal.py")
    signature = inspect.signature(require_c8_attr(script, "main"))
    assert signature.parameters["execute"].default is require_c8_attr(
        script, "execute_authorized_attempt"
    )


def test_default_composition_loads_builds_and_runs_the_same_authorization() -> None:
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

    def build(*, authorization):
        calls.append(("build", authorization))
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
        "/tmp/grant.json",
        "/tmp/grant.json.sig",
        dependencies_loader=lambda: dependencies,
    )
    assert exit_code == 0
    assert calls == [
        ("load", "/tmp/grant.json", "/tmp/grant.json.sig"),
        ("build", authorization),
        ("run", authorization, adapters, True),
    ]


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
        wiring_builder=lambda *, authorization: wiring,
        runner=lambda _authorization, _adapters, *, execute_requested: SimpleNamespace(
            outcome=outcome
        ),
    )
    exit_code = require_c8_attr(script, "execute_authorized_attempt")(
        "/tmp/grant.json",
        "/tmp/grant.json.sig",
        dependencies_loader=lambda: dependencies,
    )
    assert exit_code == require_c8_attr(script, "HOLD_EXIT")
    assert exit_code != 0


@pytest.mark.parametrize("name", C8_SCRIPT_NAMES)
def test_entrypoint_surface_is_bounded(name: str) -> None:
    script = load_c8_script(name)
    expected = {"HOLD_EXIT", "build_parser", "main"}
    if name == "run_topology_rehearsal.py":
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


def test_runtime_wiring_injects_the_one_executor_into_every_command_adapter() -> None:
    script = load_c8_script("run_topology_rehearsal.py")
    command_runner = fakes.FakeCommandRunner(fakes.CallLog())
    wiring = runtime_wiring(script, command_runner=command_runner)
    assert wiring.command_runner is command_runner
    assert wiring.plan.commands == built_plan().commands
    assert tuple(wiring.command_adapters) == COMMAND_ADAPTER_NAMES
    # One executor object, shared by identity: a per-adapter runner would be a second
    # process seam that no AST control over the single spawn site can see.
    for name in COMMAND_ADAPTER_NAMES:
        adapter = wiring.command_adapters[name]
        assert adapter.runner is command_runner
        assert adapter.plan is wiring.plan


def test_runtime_wiring_defaults_to_the_single_subprocess_executor() -> None:
    """The default execute path may not silently wire some other process seam."""
    script = load_c8_script("run_topology_rehearsal.py")
    wiring = runtime_wiring(script)
    executor_type = require_c8_attr(script, "SubprocessCommandRunner")
    assert isinstance(wiring.command_runner, executor_type)
    for name in COMMAND_ADAPTER_NAMES:
        assert wiring.command_adapters[name].runner is wiring.command_runner


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
