"""Every real effect is implemented by one adapter bound to a named plan command."""

from __future__ import annotations

import ast
import json
import inspect
import threading
import textwrap
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

import fakes
import documents
from conftest import load_c8, require_c8_attr


COMMAND_ADAPTERS = {
    "ControlIdentityCommandAdapter": "ControlIdentitySource",
    "DockerCommandAdapter": "DockerPort",
    "HostCommandAdapter": "HostObservationSource",
    "ProbeCommandAdapter": "ProbePort",
    "SshSignatureCommandAdapter": "SignatureVerifier",
}
# Concrete adapters that own a resource or a host capability rather than a planned command.
# `MonotonicClock` belongs here: the 180-second envelope needs a real elapsed-time source,
# and leaving it unauthored would let the runner reach for one itself.
RESOURCE_ADAPTERS = {
    "AtomicFileAttemptLedger": "AttemptLedger",
    "CredentialFileAdapter": "CredentialPort",
    "MonotonicClock": "Clock",
}
EFFECT_BINDINGS = {
    "observe_controls": tuple(
        f"control:{repository}:{observation}"
        for repository in fakes.EXPECTED_CONTROLS
        for observation in ("commit", "tree", "status")
    ),
    "observe_image": ("docker:image",),
    "observe_ephemeral_range": ("host:ephemeral_range",),
    "observe_listeners": ("host:listeners",),
    "observe_platform": ("docker:platform",),
    "observe_executable_digest": ("docker:digest",),
    "observe_publications": ("docker:publications",),
    "create_network": ("docker:create_network",),
    "create_volume": ("docker:create_volume",),
    "create_container": ("docker:create_container",),
    "start_container": ("docker:start_container",),
    "observe_health": ("docker:health",),
    "observe_container": ("docker:container",),
    "observe_daemon_event": ("docker:event",),
    "observe_docker_port": ("docker:port",),
    "observe_network": ("docker:network",),
    "remove:container": ("docker:remove_container",),
    "remove:network": ("docker:remove_network",),
    "remove:volume": ("docker:remove_volume",),
    "observe_residual": ("docker:residual",),
    "observe_digest": ("probe:digest",),
    "probe": ("probe:host",),
    "verify_signature": ("signature:verify",),
}


def built_plan():
    plan = load_c8("plan")
    return require_c8_attr(plan, "build_plan")(
        attempt_id=fakes.SYNTHETIC_ATTEMPT_ID,
        image_reference=f"postgres@{fakes.SYNTHETIC_MANIFEST_DIGEST}",
        repository_roots=fakes.SYNTHETIC_REPOSITORY_ROOTS,
    )


@pytest.mark.parametrize(
    ("adapter_name", "protocol_name"),
    sorted({**COMMAND_ADAPTERS, **RESOURCE_ADAPTERS}.items()),
)
def test_each_real_effect_adapter_implements_one_injected_protocol(
    adapter_name: str, protocol_name: str
) -> None:
    adapter = load_c8("adapter")
    protocols = load_c8("protocols")
    adapter_type = require_c8_attr(adapter, adapter_name)
    assert require_c8_attr(protocols, protocol_name) in adapter_type.__mro__


def test_command_adapters_take_only_the_reviewed_plan_and_runner() -> None:
    adapter = load_c8("adapter")
    for name in COMMAND_ADAPTERS:
        signature = inspect.signature(require_c8_attr(adapter, name))
        assert tuple(signature.parameters)[:2] == ("plan", "runner")


def test_effect_binding_table_is_exact_complete_and_uses_every_planned_command() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    observed = require_c8_attr(adapter, "EFFECT_BINDINGS")
    assert dict(observed) == EFFECT_BINDINGS
    flattened = tuple(effect for effects in observed.values() for effect in effects)
    assert set(flattened) == set(plan.commands)
    assert len(flattened) == len(set(flattened))


def test_exact_command_executor_runs_every_plan_entry_without_reconstruction() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    responses = {
        command: fakes.FakeCommandResult(stdout="synthetic\n")
        for command in plan.commands.values()
    }
    log = fakes.CallLog()
    executor = require_c8_attr(adapter, "ExactCommandAdapter")(
        plan, fakes.FakeCommandRunner(log, responses)
    )
    for effect in plan.commands:
        stdin = documents.SIGNATURE_BYTES if effect == "signature:verify" else None
        executor.run_effect(effect, timeout_seconds=5, stdin=stdin)
    calls = log.calls("command.run")
    assert tuple(call["argv"] for call in calls) == tuple(plan.commands.values())
    # Bound to the signature command itself, not to a position in mapping order.
    signature_command = plan.commands["signature:verify"]
    by_command = {call["argv"]: call for call in calls}
    assert by_command[signature_command]["stdin"] == documents.SIGNATURE_BYTES
    assert all(
        call["stdin"] is None
        for command, call in by_command.items()
        if command != signature_command
    )


def test_docker_create_observe_and_teardown_all_use_named_plan_entries() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    selected = (
        "docker:digest",
        "docker:create_network",
        "docker:create_volume",
        "docker:create_container",
        "docker:start_container",
        "docker:container",
        "docker:remove_container",
        "docker:remove_network",
        "docker:remove_volume",
        "docker:residual",
    )
    responses = {
        plan.commands[name]: fakes.FakeCommandResult(stdout="{}\n") for name in selected
    }
    log = fakes.CallLog()
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan, fakes.FakeCommandRunner(log, responses)
    )
    assert docker.observe_executable_digest(path=fakes.DOCKER_EXECUTABLE_PATH) == "{}"
    docker.create_network(name=plan.network_name, internal=True)
    docker.create_volume(name=plan.volume_name)
    docker.create_container(
        name=plan.container_name,
        image=f"postgres@{fakes.SYNTHETIC_MANIFEST_DIGEST}",
        network=plan.network_name,
        volume=plan.volume_name,
        publish=fakes.PUBLISH_SPEC,
        pull=fakes.PULL_POLICY,
        environment={"POSTGRES_PASSWORD_FILE": fakes.CONTAINER_CREDENTIAL_PATH},
    )
    docker.start_container(name=plan.container_name)
    docker.observe_container(container=plan.container_name)
    for kind, name in (
        ("container", plan.container_name),
        ("network", plan.network_name),
        ("volume", plan.volume_name),
    ):
        docker.remove(kind=kind, name=name)
    docker.observe_residual()
    assert tuple(call["argv"] for call in log.calls("command.run")) == tuple(
        plan.commands[name] for name in selected
    )


def test_high_level_argument_drift_is_rejected_before_any_command() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    log = fakes.CallLog()
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan, fakes.FakeCommandRunner(log)
    )
    with pytest.raises(ValueError):
        docker.create_network(name="wrong", internal=True)
    assert log.entries == ()


def test_realistic_adapter_outputs_decode_to_the_reviewed_semantics(monkeypatch) -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    responses = {
        plan.commands["docker:digest"]: fakes.FakeCommandResult(
            stdout=f"{fakes.SYNTHETIC_DOCKER_SHA256}  {fakes.DOCKER_EXECUTABLE_PATH}\n"
        ),
        plan.commands["host:listeners"]: fakes.FakeCommandResult(
            stdout=f"p123\nn{fakes.HOST_IP}:{fakes.HOST_PORT}\n"
        ),
        plan.commands["docker:event"]: fakes.FakeCommandResult(
            stdout=json.dumps(fakes.OBSERVED_PUBLICATION) + "\n"
        ),
        plan.commands["docker:health"]: fakes.FakeCommandResult(stdout='"healthy"\n'),
        plan.commands["probe:host"]: fakes.FakeCommandResult(returncode=0),
    }
    runner = fakes.FakeCommandRunner(fakes.CallLog(), responses)
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(plan, runner)
    host = require_c8_attr(adapter, "HostCommandAdapter")(plan, runner)
    probe = require_c8_attr(adapter, "ProbeCommandAdapter")(plan, runner)
    monkeypatch.setattr(adapter.time, "monotonic", lambda: 10.0)
    assert docker.observe_executable_digest(path=fakes.DOCKER_EXECUTABLE_PATH) == (
        fakes.SYNTHETIC_DOCKER_SHA256
    )
    assert host.observe_listeners(port=fakes.HOST_PORT) == (
        {"address": fakes.HOST_IP, "port": fakes.HOST_PORT, "protocol": "tcp"},
    )
    assert docker.observe_daemon_event(container=plan.container_name) == (
        fakes.OBSERVED_PUBLICATION
    )
    assert docker.observe_health(container=plan.container_name, deadline=20.0) == "healthy"
    assert probe.run(
        executable=fakes.PROBE_EXECUTABLE_PATH, argv=fakes.PROBE_ARGV
    ) == "reachable"


def test_listener_absence_is_resolved_empty_but_command_errors_are_unresolved() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    for result, expected in (
        (fakes.FakeCommandResult(returncode=1), ()),
        (fakes.FakeCommandResult(returncode=2, stderr="lsof error\n"), None),
    ):
        runner = fakes.FakeCommandRunner(
            fakes.CallLog(), {plan.commands["host:listeners"]: result}
        )
        host = require_c8_attr(adapter, "HostCommandAdapter")(plan, runner)
        assert host.observe_listeners(port=fakes.HOST_PORT) == expected


@pytest.mark.parametrize(
    ("rendered", "address"),
    [
        ("n*:15433\n", "0.0.0.0"),
        ("n0.0.0.0:15433\n", "0.0.0.0"),
        ("n[::]:15433\n", "::"),
        ("n[::1]:15433\n", "::1"),
    ],
)
def test_listener_decoder_preserves_wildcard_and_ipv6_for_fail_closed_classification(
    rendered: str, address: str
) -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    runner = fakes.FakeCommandRunner(
        fakes.CallLog(),
        {plan.commands["host:listeners"]: fakes.FakeCommandResult(stdout=rendered)},
    )
    host = require_c8_attr(adapter, "HostCommandAdapter")(plan, runner)
    assert host.observe_listeners(port=fakes.HOST_PORT) == (
        {"address": address, "port": fakes.HOST_PORT, "protocol": "tcp"},
    )


def test_an_undecodable_listener_field_is_unresolved_not_false_absence() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    runner = fakes.FakeCommandRunner(
        fakes.CallLog(),
        {
            plan.commands["host:listeners"]: fakes.FakeCommandResult(
                stdout="nnot-a-listener-address\n"
            )
        },
    )
    host = require_c8_attr(adapter, "HostCommandAdapter")(plan, runner)
    assert host.observe_listeners(port=fakes.HOST_PORT) is None


def test_failed_probe_returns_a_diagnostic_refusal_not_a_false_reachable() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    runner = fakes.FakeCommandRunner(
        fakes.CallLog(),
        {plan.commands["probe:host"]: fakes.FakeCommandResult(returncode=1)},
    )
    probe = require_c8_attr(adapter, "ProbeCommandAdapter")(plan, runner)
    assert probe.run(
        executable=fakes.PROBE_EXECUTABLE_PATH, argv=fakes.PROBE_ARGV
    ) == "refused"


def test_attempt_ledger_serializes_two_consumers_and_persists_one_entry(
    tmp_path: Path,
) -> None:
    adapter = load_c8("adapter")
    ledger_type = require_c8_attr(adapter, "AtomicFileAttemptLedger")
    ledger_path = tmp_path / "attempt-ledger"
    rendezvous = threading.Barrier(2)
    first_done = threading.Event()
    local = threading.local()

    class InterleavedLedger(ledger_type):
        """Coordinates through the public consumed-state seam, never private storage.

        An implementation that serializes before consulting `is_consumed` reaches the
        barrier from only one thread; the bounded broken-barrier path then lets it proceed.
        An implementation that does not consult this public method is unaffected.
        """

        def is_consumed(self, *, record_id: str) -> bool:
            calls = getattr(local, "calls", 0) + 1
            local.calls = calls
            snapshot = super().is_consumed(record_id=record_id)
            if calls == 1:
                try:
                    rendezvous.wait(timeout=0.25)
                except threading.BrokenBarrierError:
                    return snapshot
                if local.label == "second":
                    assert first_done.wait(timeout=5)
            return snapshot

    first = InterleavedLedger(str(ledger_path))
    second = InterleavedLedger(str(ledger_path))

    def consume(label: str, ledger):
        local.label = label
        try:
            ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=1)
            return None
        except BaseException as error:
            return error
        finally:
            if label == "first":
                first_done.set()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = tuple(
            pool.map(
                lambda item: consume(*item),
                (("first", first), ("second", second)),
            )
        )
    assert sum(result is None for result in results) == 1
    failures = tuple(result for result in results if result is not None)
    assert len(failures) == 1 and isinstance(failures[0], ValueError)
    assert "already consumed" in str(failures[0])
    assert ledger_path.read_text(encoding="utf-8").splitlines() == [
        f"{fakes.RECORD_ID} 1"
    ]
    assert not (tmp_path / "attempt-ledger.pending").exists()


@pytest.mark.parametrize("attempt_ordinal", (0, 2))
def test_attempt_ledger_refuses_any_ordinal_other_than_one_before_write(
    tmp_path: Path, attempt_ordinal: int
) -> None:
    adapter = load_c8("adapter")
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(
        str(tmp_path / "attempt-ledger")
    )
    with pytest.raises(ValueError):
        ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=attempt_ordinal)
    assert tuple(tmp_path.iterdir()) == ()


def test_adapter_source_contains_one_runner_call_and_no_inline_effect_argv() -> None:
    adapter = load_c8("adapter")
    path_text = inspect.getsourcefile(require_c8_attr(adapter, "ExactCommandAdapter"))
    assert path_text is not None
    path = Path(path_text)
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    run_calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "run"
    ]
    assert len(run_calls) == 1
    forbidden_literals = {
        "docker",
        "/usr/bin/git",
        "/usr/bin/ssh-keygen",
        "/usr/bin/nc",
        "/usr/sbin/lsof",
        "/usr/sbin/sysctl",
    }
    assert not {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and node.value in forbidden_literals
    }


def class_tree(name: str) -> ast.Module:
    """The parsed syntax of one authored adapter class."""
    adapter = load_c8("adapter")
    source = textwrap.dedent(inspect.getsource(require_c8_attr(adapter, name)))
    return ast.parse(source)


def attribute_names(tree: ast.AST) -> set[str]:
    return {node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)}


def int_constants(tree: ast.AST) -> set[int]:
    return {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and type(node.value) is int
    }


def test_secure_file_adapters_require_no_follow_exclusive_create_mode_and_fsync() -> None:
    """Stated over syntax, so a matching flag inside a comment or docstring cannot pass."""
    credential = class_tree("CredentialFileAdapter")
    assert {"O_CREAT", "O_EXCL", "O_NOFOLLOW", "fsync"} <= attribute_names(credential)
    assert 0o600 in int_constants(credential)
    ledger = class_tree("AtomicFileAttemptLedger")
    assert {"O_CREAT", "O_EXCL", "O_NOFOLLOW", "fsync", "replace"} <= attribute_names(
        ledger
    )


@pytest.mark.parametrize("name", sorted(RESOURCE_ADAPTERS))
def test_no_resource_adapter_reaches_for_a_process_or_a_shell(name: str) -> None:
    """A resource adapter owns a file or a clock; a process is somebody else's seam."""
    reached = attribute_names(class_tree(name))
    assert not reached & {"system", "popen", "Popen", "run", "call", "check_output"}


def test_adapter_exports_only_the_reviewed_concrete_effect_boundary() -> None:
    adapter = load_c8("adapter")
    assert set(require_c8_attr(adapter, "__all__")) == {
        "EFFECT_BINDINGS",
        "ExactCommandAdapter",
        *COMMAND_ADAPTERS,
        *RESOURCE_ADAPTERS,
    }
