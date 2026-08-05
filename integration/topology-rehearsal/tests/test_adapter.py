"""Every real effect is implemented by one adapter bound to a named plan command."""

from __future__ import annotations

import ast
import inspect
import json
import os
import stat
import textwrap
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace

import documents
import fakes
import pytest
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
    "observe_residual": (
        "docker:residual_container",
        "docker:residual_network",
        "docker:residual_volume",
    ),
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
    assert tuple(
        inspect.signature(require_c8_attr(adapter, "DockerCommandAdapter")).parameters
    ) == ("plan", "runner", "clock")


def test_exact_command_adapter_rejects_a_non_runner_before_any_effect() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    with pytest.raises(TypeError, match="runner|CommandRunner"):
        require_c8_attr(adapter, "ExactCommandAdapter")(plan, object())


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
        "docker:residual_container",
        "docker:residual_network",
        "docker:residual_volume",
    )
    responses = {
        plan.commands[name]: fakes.FakeCommandResult(
            stdout="" if name.startswith("docker:residual") else "{}\n"
        )
        for name in selected
    }
    log = fakes.CallLog()
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan, fakes.FakeCommandRunner(log, responses), fakes.FakeClock(log)
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
        plan, fakes.FakeCommandRunner(log), fakes.FakeClock(log)
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
    log = fakes.CallLog()
    runner = fakes.FakeCommandRunner(log, responses)
    clock = fakes.FakeClock(log, ticks=(10.0,))
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(plan, runner, clock)
    host = require_c8_attr(adapter, "HostCommandAdapter")(plan, runner)
    probe = require_c8_attr(adapter, "ProbeCommandAdapter")(plan, runner)
    monkeypatch.setattr(
        adapter.time,
        "monotonic",
        lambda: pytest.fail("DockerCommandAdapter must use the injected clock"),
    )
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
    health_calls = [
        call
        for call in log.calls("command.run")
        if call["argv"] == plan.commands["docker:health"]
    ]
    assert len(health_calls) == 1
    assert health_calls[0]["timeout_seconds"] == 10.0
    assert probe.run(
        executable=fakes.PROBE_EXECUTABLE_PATH, argv=fakes.PROBE_ARGV
    ) == "reachable"


def test_health_deadline_boundaries_never_run_late_or_widen_the_envelope() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()

    expired_log = fakes.CallLog()
    expired = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan,
        fakes.FakeCommandRunner(expired_log),
        fakes.FakeClock(expired_log, ticks=(20.0,)),
    )
    assert expired.observe_health(container=plan.container_name, deadline=20.0) is None
    assert expired_log.calls("command.run") == ()

    bounded_log = fakes.CallLog()
    bounded_runner = fakes.FakeCommandRunner(
        bounded_log,
        {plan.commands["docker:health"]: fakes.FakeCommandResult(stdout='"healthy"\n')},
    )
    bounded = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan, bounded_runner, fakes.FakeClock(bounded_log, ticks=(0.0,))
    )
    assert bounded.observe_health(container=plan.container_name, deadline=1000.0) == (
        "healthy"
    )
    health_call = bounded_log.calls("command.run")[-1]
    assert health_call["timeout_seconds"] == fakes.RUNTIME_LIMIT_SECONDS


def test_listener_absence_is_resolved_empty_but_command_errors_are_unresolved() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    for result, expected in (
        (fakes.FakeCommandResult(returncode=1), ()),
        (
            fakes.FakeCommandResult(returncode=1, stderr="permission denied\n"),
            None,
        ),
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
        # `lsof` renders a wildcard bind as `*`. It is carried through exactly as observed
        # rather than re-spelled as an equivalent dotted-quad: the decoder's job is to
        # report what was seen, and inventing an address literal the tool never emitted
        # would put a non-loopback spelling into authored source for no observational gain.
        ("n*:15433\n", "*"),
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


@pytest.mark.parametrize("rendered", ("n*:15433\n", "n0.0.0.0:15433\n", "n[::]:15433\n"))
def test_no_wildcard_listener_is_ever_decoded_as_the_reviewed_loopback(
    rendered: str,
) -> None:
    """A wildcard bind must stay distinguishable from the one reviewed binding.

    Whatever spelling the decoder carries through, it may never equal `127.0.0.1`: a
    wildcard listener that compared equal to the reviewed loopback would be admitted as
    the very publication the rehearsal exists to refuse.
    """
    adapter = load_c8("adapter")
    plan = built_plan()
    runner = fakes.FakeCommandRunner(
        fakes.CallLog(),
        {plan.commands["host:listeners"]: fakes.FakeCommandResult(stdout=rendered)},
    )
    host = require_c8_attr(adapter, "HostCommandAdapter")(plan, runner)
    observed = host.observe_listeners(port=fakes.HOST_PORT)
    assert observed is not None
    assert [listener["address"] for listener in observed] != [fakes.HOST_IP]


def test_no_authored_adapter_byte_spells_a_non_loopback_address_literal() -> None:
    """The wildcard decoding may not be bought with a forbidden literal in source.

    `test_surface_contract` states this tree-wide; it is restated here against the exact
    module that has to describe a wildcard bind, so the regression is attributed to the
    decoder rather than to a distant scan.
    """
    adapter = load_c8("adapter")
    path_text = inspect.getsourcefile(require_c8_attr(adapter, "ExactCommandAdapter"))
    assert path_text is not None
    text = Path(path_text).read_text(encoding="utf-8")
    assert [
        literal
        for literal in ("0.0.0.0", "::1", "[::]", "localhost")
        if literal in text
    ] == []


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


def test_an_empty_daemon_event_attribute_is_unresolved_not_a_publication() -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    log = fakes.CallLog()
    runner = fakes.FakeCommandRunner(
        log,
        {plan.commands["docker:event"]: fakes.FakeCommandResult(stdout='""\n')},
    )
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan, runner, fakes.FakeClock(log)
    )
    assert docker.observe_daemon_event(container=plan.container_name) is None


# ---------------------------------------------------------------------------
# Platform evidence
#
# `docker version --format {{json .}}` renders a nested client/server document, while
# `preparation` compares the flat `PLATFORM_EVIDENCE_KEYS` inventory. Diagnosis section 3
# records exactly what that document has to yield: "Docker Desktop `4.84.0` build `234817`,
# Docker client/server `29.6.2`, API `1.55`". Those readings are replayed here through
# `fakes.DOCUMENTED_PLATFORM`, so the raw document and the expected inventory cannot drift
# apart inside this file. The Desktop product name is carried on the SERVER platform, not
# the client: Docker's own macOS example renders `Client: Docker Engine - Community` and
# `Server: Docker Desktop <version> (<build>)`, because the daemon is the Desktop product
# and the CLI is only its client.
# ---------------------------------------------------------------------------
DESKTOP_PLATFORM_NAME = (
    f"Docker Desktop {fakes.DOCUMENTED_PLATFORM['desktop_version']} "
    f"({fakes.DOCUMENTED_PLATFORM['desktop_build']})"
)
DESKTOP_PLATFORM_PATH = ("Server", "Platform", "Name")
ENGINE_VERSION_PATH = ("Server", "Version")
API_VERSION_PATH = ("Server", "ApiVersion")
DROPPED = object()


def version_document() -> dict:
    """One realistic raw `docker version --format {{json .}}` projection.

    Docker Desktop states its own version and build only inside the SERVER platform name,
    because the daemon is the Desktop product the attempt actually talks to; the CLI is
    merely its client and renders as `Docker Engine - Community` on Docker's own macOS
    example. `docker/cli`'s formatter defines the server product name at
    `Server.Platform.Name`, which is why the four reviewed facts are read from the server
    section alone. The surrounding fields are carried too, so the normalization is stated
    against the document the command renders rather than against a pre-flattened stand-in
    that would prove nothing about the real shape.
    """
    engine = fakes.DOCUMENTED_PLATFORM["engine_version"]
    api = fakes.DOCUMENTED_PLATFORM["api_version"]
    return {
        "Client": {
            "Version": engine,
            "ApiVersion": api,
            "Os": "darwin",
            "Arch": "arm64",
            "Context": "desktop-linux",
            "Platform": {"Name": "Docker Engine - Community"},
        },
        "Server": {
            "Platform": {"Name": DESKTOP_PLATFORM_NAME},
            "Components": [
                {"Name": "Engine", "Version": engine, "Details": {"ApiVersion": api}}
            ],
            "Version": engine,
            "ApiVersion": api,
            "MinAPIVersion": "1.24",
            "Os": "linux",
            "Arch": "arm64",
        },
    }


def patched_document(path, value) -> dict:
    """A fresh realistic document with exactly one field replaced or dropped."""
    document = version_document()
    reached = document
    for key in path[:-1]:
        reached = reached[key]
    if value is DROPPED:
        del reached[path[-1]]
    else:
        reached[path[-1]] = value
    return document


def platform_observation(result):
    """The adapter's platform observation for one scripted `docker version` result."""
    adapter = load_c8("adapter")
    plan = built_plan()
    log = fakes.CallLog()
    runner = fakes.FakeCommandRunner(log, {plan.commands["docker:platform"]: result})
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan, runner, fakes.FakeClock(log)
    )
    return docker.observe_platform()


def projected_platform(document):
    """The observation for one raw document, rendered as the command renders it."""
    return platform_observation(
        fakes.FakeCommandResult(stdout=json.dumps(document) + "\n")
    )


def test_the_raw_docker_version_document_becomes_the_flat_reviewed_inventory() -> None:
    """The nested document Docker renders is flattened to the four reviewed keys, and only
    to those: an extra key is a claim nobody reviewed and `preparation` refuses the whole
    inventory for it.
    """
    constants = load_c8("constants")
    keys = require_c8_attr(constants, "PLATFORM_EVIDENCE_KEYS")
    observed = projected_platform(version_document())
    assert observed is not None
    assert set(observed) == set(keys)
    assert dict(observed) == dict(fakes.DOCUMENTED_PLATFORM)
    # `preparation` reads each value with `type(value) is not str`, so a subclass or a
    # non-string carried straight out of the raw document would be refused there.
    assert all(type(observed[key]) is str and observed[key] for key in keys)


def test_the_normalized_platform_evidence_satisfies_the_phase_that_consumes_it() -> None:
    """Proven by calling `preparation`, not assumed: the two halves must actually agree.

    The adapter and the phase are the two ends of one contract. Restating the expected
    shape here alone would leave exactly the drift that let a nested client/server document
    be returned as platform evidence no phase could ever accept.
    """
    preparation = load_c8("preparation")
    findings = require_c8_attr(preparation, "platform_evidence_findings")
    observed = projected_platform(version_document())
    assert findings(observed, fakes.DOCUMENTED_PLATFORM["engine_version"]) == ()
    # The comparison is real: a drifted grant is still refused through these same values.
    assert findings(observed, "29.6.3") != ()


@pytest.mark.parametrize(
    ("path", "value"),
    [
        pytest.param(("Server",), DROPPED, id="no-server-section"),
        pytest.param(("Server",), "29.6.2", id="server-section-not-an-object"),
        pytest.param(("Server", "Platform"), DROPPED, id="no-server-platform"),
        pytest.param(DESKTOP_PLATFORM_PATH, DROPPED, id="no-platform-name"),
        pytest.param(DESKTOP_PLATFORM_PATH, "", id="empty-platform-name"),
        pytest.param(DESKTOP_PLATFORM_PATH, ["Docker Desktop 4.84.0 (234817)"], id="name-not-a-string"),
        pytest.param(DESKTOP_PLATFORM_PATH, "Docker Engine - Community", id="not-a-desktop-platform"),
        pytest.param(DESKTOP_PLATFORM_PATH, "Docker Desktop 4.84.0", id="no-build-in-the-name"),
        pytest.param(DESKTOP_PLATFORM_PATH, "Docker Desktop 4.84.0 (234817", id="unterminated-build"),
        pytest.param(DESKTOP_PLATFORM_PATH, "Docker Desktop  (234817)", id="no-version-in-the-name"),
        pytest.param(DESKTOP_PLATFORM_PATH, "Docker Desktop 4.84.0 ()", id="empty-build"),
        pytest.param(ENGINE_VERSION_PATH, DROPPED, id="no-engine-version"),
        pytest.param(ENGINE_VERSION_PATH, "", id="empty-engine-version"),
        pytest.param(ENGINE_VERSION_PATH, 29, id="engine-version-not-a-string"),
        pytest.param(API_VERSION_PATH, DROPPED, id="no-api-version"),
        pytest.param(API_VERSION_PATH, None, id="unread-api-version"),
        pytest.param(API_VERSION_PATH, 1.55, id="api-version-not-a-string"),
    ],
)
def test_an_unreadable_platform_field_leaves_the_whole_observation_unresolved(
    path, value
) -> None:
    """No partial inventory and no invented placeholder: the whole reading is `None`.

    A field that cannot be read exactly cannot be filled in. An inventory short of the
    reviewed keys is refused downstream as drift, and a fabricated stand-in would be a
    platform identity nobody ever observed.
    """
    assert projected_platform(patched_document(path, value)) is None


def test_the_2900_only_api_version_spelling_is_never_read() -> None:
    """`Server.APIVersion` was a one-off 29.0.0 regression, not a supported spelling.

    docker/cli's formatter emits `Server.ApiVersion` for the 29.6.2 target; the capitalized
    `APIVersion` key existed only in the 29.0.0 release and was restored to `ApiVersion` by
    docker/cli PR #6648 for 29.0.1. No supported-version policy authorizes reading it, so a
    document that carries only that spelling must leave the whole observation unresolved
    rather than accept it as the API version. `patched_document` cannot both drop one field
    and set another in a single call, so this is its own test rather than a table row.
    """
    document = version_document()
    del document["Server"]["ApiVersion"]
    document["Server"]["APIVersion"] = fakes.DOCUMENTED_PLATFORM["api_version"]
    assert projected_platform(document) is None


def test_an_absent_client_section_still_resolves_the_full_platform_evidence() -> None:
    """None of the four reviewed facts come from the client, so it need not even be present.

    The adapter reads the daemon's own SERVER projection; the CLI's client section is not a
    carrier of any reviewed fact and its absence must not affect the resolved inventory.
    """
    document = version_document()
    del document["Client"]
    assert projected_platform(document) == dict(fakes.DOCUMENTED_PLATFORM)


def test_drifted_client_fields_are_ignored_because_the_daemon_is_read_not_the_cli() -> None:
    """A client that disagrees with the daemon must not be able to smuggle its own values in.

    Every client field is replaced with a decoy that differs from the reviewed evidence. If
    the adapter accidentally read any of them, the resolved inventory would drift away from
    `fakes.DOCUMENTED_PLATFORM`; instead it must resolve exactly as if the client had never
    been touched, because the four reviewed facts are read from the server alone.
    """
    document = version_document()
    document["Client"]["Platform"]["Name"] = "Docker Desktop 9.9.9 (000000)"
    document["Client"]["Version"] = "1.2.3"
    document["Client"]["ApiVersion"] = "9.99"
    assert projected_platform(document) == dict(fakes.DOCUMENTED_PLATFORM)


def test_conflicting_server_api_version_spellings_are_unresolved() -> None:
    """Two disagreeing spellings of the same fact are an ambiguity, not a tiebreak.

    `Server.ApiVersion` is the 29.6.2 spelling this adapter reads. If the raw document also
    carries the 29.0.0-only `Server.APIVersion` key with a *different* value, there is no
    warrant for silently preferring one over the other, so the whole observation must be
    unresolved. Carrying both spellings with the *same* value is not a conflicting claim —
    it is simply an unread extra key sitting alongside the one that is read — so that case
    resolves normally in the companion test below.
    """
    document = version_document()
    document["Server"]["APIVersion"] = "1.99"
    assert projected_platform(document) is None


def test_an_unread_duplicate_api_version_spelling_does_not_block_resolution() -> None:
    """A duplicate spelling that agrees with the read key is not a claim, so it is ignored.

    `Server.APIVersion` is never read. Carrying it alongside `Server.ApiVersion` with the
    same value is just an extra key nobody consults, not a second, conflicting assertion
    about the API version, so resolution proceeds exactly as it would without it.
    """
    document = version_document()
    document["Server"]["APIVersion"] = fakes.DOCUMENTED_PLATFORM["api_version"]
    assert projected_platform(document) == dict(fakes.DOCUMENTED_PLATFORM)


@pytest.mark.parametrize(
    "result",
    (
        fakes.FakeCommandResult(returncode=1, stderr="cannot connect to the daemon\n"),
        fakes.FakeCommandResult(returncode=125),
        fakes.FakeCommandResult(returncode=-1),
        fakes.FakeCommandResult(stdout=""),
        fakes.FakeCommandResult(stdout="not a json document\n"),
        fakes.FakeCommandResult(stdout='"29.6.2"\n'),
        fakes.FakeCommandResult(stdout="[]\n"),
        *fakes.MALFORMED_COMMAND_RESULTS,
    ),
)
def test_a_platform_projection_that_did_not_resolve_is_never_platform_evidence(
    result,
) -> None:
    """A failed status, a payload that is not an object and a malformed result all read
    as the unresolved observation they are, never as a platform identity.
    """
    assert platform_observation(result) is None


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


SIGNATURE = b"-----BEGIN SSH SIGNATURE-----\nsynthetic-detached-signature\n"
OTHER_SIGNATURE = b"-----BEGIN SSH SIGNATURE-----\na-different-signature\n"


def signature_plan(suite_root: Path):
    """A plan whose Suite control root is a real directory this test owns."""
    plan = load_c8("plan")
    roots = {
        **fakes.SYNTHETIC_REPOSITORY_ROOTS,
        fakes.SUITE_CONTROL: str(suite_root),
    }
    return require_c8_attr(plan, "build_plan")(
        attempt_id=fakes.SYNTHETIC_ATTEMPT_ID,
        image_reference=f"postgres@{fakes.SYNTHETIC_MANIFEST_DIGEST}",
        repository_roots=roots,
    )


def write_signature(plan, payload: bytes) -> Path:
    path = Path(plan.signature_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return path


def signature_verifier(plan, returncode: int = 0):
    return signature_verifier_for(plan, fakes.FakeCommandResult(returncode=returncode))


def signature_verifier_for(plan, result):
    """A verifier whose one planned verification answers with exactly `result`."""
    adapter = load_c8("adapter")
    log = fakes.CallLog()
    runner = fakes.FakeCommandRunner(log, {plan.commands["signature:verify"]: result})
    verifier = require_c8_attr(adapter, "SshSignatureCommandAdapter")(plan, runner)
    return verifier, log


def verify(verifier, signature_bytes: bytes = SIGNATURE):
    return verifier.verify(
        grant_bytes=b"{}",
        signature_bytes=signature_bytes,
        signer=fakes.SIGNER,
        namespace=fakes.AUTHORIZATION_NAMESPACE,
    )


@pytest.mark.parametrize(("returncode", "expected"), ((0, True), (1, False)))
def test_signature_verification_accepts_only_the_exact_bytes_it_was_asked_about(
    tmp_path: Path, returncode: int, expected: bool
) -> None:
    """The verdict belongs to `signature_bytes`, not to whatever was on disk at run time.

    The reviewed argv names the signature by path, so `ssh-keygen` reads the file itself.
    A verdict returned for the caller's argument while a different file was verified would
    attribute an external signature to bytes nobody checked.
    """
    plan = signature_plan(tmp_path)
    write_signature(plan, SIGNATURE)
    verifier, log = signature_verifier(plan, returncode=returncode)
    assert verify(verifier) is expected
    assert log.count("command.run") == 1


@pytest.mark.parametrize("returncode", (1, 2, 125, 255))
def test_only_an_executed_positive_status_is_the_signers_own_refusal(
    tmp_path: Path, returncode: int
) -> None:
    """`False` means `ssh-keygen` ran, read the bound bytes and rejected them."""
    plan = signature_plan(tmp_path)
    write_signature(plan, SIGNATURE)
    verifier, log = signature_verifier(plan, returncode=returncode)
    assert verify(verifier) is False
    assert log.count("command.run") == 1


@pytest.mark.parametrize(
    "result",
    (
        # The unresolved sentinel of a default-constructed result: nothing ever executed.
        fakes.FakeCommandResult(returncode=-1),
        # A timeout or a signal death: the verification was killed, not answered.
        fakes.FakeCommandResult(returncode=-9),
        fakes.FakeCommandResult(returncode=-15),
        *fakes.MALFORMED_COMMAND_RESULTS,
    ),
)
def test_an_unrun_or_malformed_verification_is_unresolved_not_a_refused_signature(
    tmp_path: Path, result
) -> None:
    """A grant nobody verified may never be recorded as a grant the signer refused.

    The two carry different remedies: a refusal says the signature is wrong, while an
    unresolved check says the verification has to be run again. Collapsing the second into
    the first — and raising `AttributeError` on a malformed result instead of either —
    would misreport the state of the authorization.
    """
    plan = signature_plan(tmp_path)
    write_signature(plan, SIGNATURE)
    verifier, log = signature_verifier_for(plan, result)
    assert verify(verifier) is None
    # The exact byte binding is unchanged: the run still happens and is still re-checked.
    assert log.count("command.run") == 1


def test_signature_verification_refuses_bytes_that_are_not_the_file_it_verifies(
    tmp_path: Path,
) -> None:
    plan = signature_plan(tmp_path)
    write_signature(plan, OTHER_SIGNATURE)
    verifier, log = signature_verifier(plan)
    assert verify(verifier) is None
    # Refused before the command: a verification that ran would already have produced a
    # verdict about the wrong bytes.
    assert log.count("command.run") == 0


def test_signature_verification_refuses_a_signature_swapped_around_the_run(
    tmp_path: Path,
) -> None:
    """The bind is re-checked after the run, so the read-to-verify window fails closed.

    Between the pre-run read and `ssh-keygen`'s own read the file could be replaced. The
    bytes are therefore re-read afterwards and a change makes the verdict unresolved
    rather than an accepted signature the caller never saw.
    """
    plan = signature_plan(tmp_path)
    path = write_signature(plan, SIGNATURE)
    adapter = load_c8("adapter")
    log = fakes.CallLog()

    class SwappingRunner(fakes.FakeCommandRunner):
        def run(self, argv, *, timeout_seconds, stdin=None):
            path.write_bytes(OTHER_SIGNATURE)
            return super().run(argv, timeout_seconds=timeout_seconds, stdin=stdin)

    runner = SwappingRunner(
        log, {plan.commands["signature:verify"]: fakes.FakeCommandResult(returncode=0)}
    )
    verifier = require_c8_attr(adapter, "SshSignatureCommandAdapter")(plan, runner)
    assert verify(verifier) is None
    assert log.count("command.run") == 1


def test_signature_verification_refuses_an_absent_or_unreadable_signature(
    tmp_path: Path,
) -> None:
    plan = signature_plan(tmp_path)
    Path(plan.signature_path).parent.mkdir(parents=True, exist_ok=True)
    verifier, log = signature_verifier(plan)
    assert verify(verifier) is None
    assert log.count("command.run") == 0


def test_signature_verification_follows_no_symlink_at_the_signature_path(
    tmp_path: Path,
) -> None:
    """A signature reached through a link is somebody else's file, not this grant's."""
    plan = signature_plan(tmp_path)
    path = Path(plan.signature_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    target = tmp_path / "elsewhere.sig"
    target.write_bytes(SIGNATURE)
    path.symlink_to(target)
    verifier, log = signature_verifier(plan)
    assert verify(verifier) is None
    assert log.count("command.run") == 0


def test_signature_verification_refuses_a_non_regular_signature_path(
    tmp_path: Path,
) -> None:
    plan = signature_plan(tmp_path)
    Path(plan.signature_path).mkdir(parents=True, exist_ok=True)
    verifier, log = signature_verifier(plan)
    assert verify(verifier) is None
    assert log.count("command.run") == 0


def test_signature_verification_refuses_a_signature_larger_than_the_reviewed_bound(
    tmp_path: Path,
) -> None:
    """An oversized file is refused whole rather than compared on a truncated prefix."""
    adapter = load_c8("adapter")
    limit = require_c8_attr(adapter, "SIGNATURE_MAX_BYTES")
    plan = signature_plan(tmp_path)
    oversized = b"s" * (limit + 1)
    write_signature(plan, oversized)
    verifier, log = signature_verifier(plan)
    assert verify(verifier, signature_bytes=oversized) is None
    assert log.count("command.run") == 0


def test_signature_verification_refuses_empty_material_before_reading_anything(
    tmp_path: Path,
) -> None:
    plan = signature_plan(tmp_path)
    write_signature(plan, SIGNATURE)
    verifier, log = signature_verifier(plan)
    assert verify(verifier, signature_bytes=b"") is None
    assert verifier.verify(
        grant_bytes=b"",
        signature_bytes=SIGNATURE,
        signer=fakes.SIGNER,
        namespace=fakes.AUTHORIZATION_NAMESPACE,
    ) is None
    assert log.count("command.run") == 0


class ShortWriter:
    """A deterministic `os.write` that writes at most `chunk` bytes per call.

    It also replays a scripted sequence of interruptions and stalls, so the completion
    loop is stated against exact behaviour rather than against whatever the host kernel
    happens to do with a short buffer.
    """

    def __init__(self, chunk: int = 3, failures: tuple = ()) -> None:
        self.chunk = chunk
        self.failures = list(failures)
        self.written = bytearray()
        self.calls = 0

    def __call__(self, descriptor: int, payload) -> int:
        self.calls += 1
        if self.failures:
            failure = self.failures.pop(0)
            if isinstance(failure, BaseException):
                raise failure
            if failure == 0:
                return 0
        data = bytes(payload)[: self.chunk]
        self.written.extend(data)
        return len(data)


def test_a_short_or_interrupted_credential_write_is_completed_before_it_is_flushed(
    monkeypatch,
) -> None:
    """A credential is written whole, retrying an interruption, or it is not written.

    `os.write` may write only part of its buffer and may be interrupted, and both are
    silent in its return value. A credential truncated to its first few bytes would still
    be reported durable and would still be mounted into the container.
    """
    adapter = load_c8("adapter")
    plan = built_plan()
    writer = ShortWriter(chunk=5, failures=(InterruptedError(4, "interrupted"),))
    fsynced: list[int] = []
    monkeypatch.setattr(adapter.os, "getuid", lambda: 1234)
    monkeypatch.setattr(
        adapter.os,
        "lstat",
        lambda _path: SimpleNamespace(st_mode=stat.S_IFDIR | 0o700, st_uid=1234),
    )
    monkeypatch.setattr(adapter.os, "open", lambda *_args, **_kwargs: 10)
    monkeypatch.setattr(adapter.os, "write", writer)
    monkeypatch.setattr(adapter.os, "fsync", fsynced.append)
    monkeypatch.setattr(adapter.os, "close", lambda _descriptor: None)
    credential = require_c8_attr(adapter, "CredentialFileAdapter")(plan)
    assert credential.create(name=plan.credential_name) == plan.credential_path
    secret = bytes(writer.written)
    assert len(secret) > writer.chunk, "the write loop must not stop at one short write"
    assert writer.calls > 2, "an interruption must be retried, not counted as progress"
    assert fsynced, "the completed bytes are flushed only after the whole record"


def test_a_stalled_credential_write_refuses_rather_than_reporting_partial_material(
    monkeypatch,
) -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    writer = ShortWriter(chunk=5, failures=(0,))
    closed: list[int] = []
    monkeypatch.setattr(adapter.os, "getuid", lambda: 1234)
    monkeypatch.setattr(
        adapter.os,
        "lstat",
        lambda _path: SimpleNamespace(st_mode=stat.S_IFDIR | 0o700, st_uid=1234),
    )
    monkeypatch.setattr(adapter.os, "open", lambda *_args, **_kwargs: 10)
    monkeypatch.setattr(adapter.os, "write", writer)
    monkeypatch.setattr(
        adapter.os,
        "fsync",
        lambda _descriptor: pytest.fail("a stalled write must never reach fsync"),
    )
    monkeypatch.setattr(adapter.os, "close", closed.append)
    credential = require_c8_attr(adapter, "CredentialFileAdapter")(plan)
    with pytest.raises(ValueError, match="stalled|incomplete"):
        credential.create(name=plan.credential_name)
    assert closed == [10], "the descriptor is released even on the refusing path"


@pytest.mark.parametrize(
    ("failures", "reason"),
    (((0,), "stalled|incomplete"), ((OSError(28, "no space left"),), "no space left")),
)
def test_an_incomplete_ledger_write_never_replaces_a_good_durable_ledger(
    tmp_path: Path, monkeypatch, failures: tuple, reason: str
) -> None:
    """A partly written budget may not become the durable one-attempt ledger.

    The pending file is written whole before it is renamed over the ledger. If the write
    cannot complete, the refusal must land *before* the replace: a truncated ledger is
    read by the next attempt as an unused budget.
    """
    adapter = load_c8("adapter")
    ledger_path = tmp_path / "attempt-ledger"
    ledger_path.write_text("other-record 1\n", encoding="utf-8")
    monkeypatch.setattr(adapter.os, "write", ShortWriter(chunk=4, failures=failures))
    monkeypatch.setattr(
        adapter.os,
        "replace",
        lambda *_args: pytest.fail("an incomplete write must never be replaced in"),
    )
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    with pytest.raises((OSError, ValueError), match=reason):
        ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=1)
    assert ledger_path.read_text(encoding="utf-8") == "other-record 1\n"
    assert not (tmp_path / "attempt-ledger.pending").exists()


def test_a_short_ledger_write_still_persists_the_whole_budget(
    tmp_path: Path, monkeypatch
) -> None:
    adapter = load_c8("adapter")
    ledger_path = tmp_path / "attempt-ledger"
    real_write = adapter.os.write

    def short_write(descriptor: int, payload) -> int:
        return real_write(descriptor, bytes(payload)[:3])

    monkeypatch.setattr(adapter.os, "write", short_write)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=1)
    monkeypatch.setattr(adapter.os, "write", real_write)
    assert ledger_path.read_text(encoding="utf-8") == f"{fakes.RECORD_ID} 1\n"


def test_a_failing_close_never_masks_the_error_that_is_already_unwinding(
    tmp_path: Path, monkeypatch
) -> None:
    """The original cause must survive cleanup, or the refusal reads as a stray EBADF.

    A descriptor closed a second time raises `EBADF`. Raised from a cleanup path it would
    replace the real reason the attempt refused, and a ledger failure reported as a bad
    file descriptor is not evidence of anything.
    """
    adapter = load_c8("adapter")
    ledger_path = tmp_path / "attempt-ledger"

    def failing_close(_descriptor: int) -> None:
        raise OSError(9, "bad file descriptor")

    monkeypatch.setattr(
        adapter.os,
        "write",
        lambda _descriptor, _payload: (_ for _ in ()).throw(
            OSError(28, "no space left on device")
        ),
    )
    monkeypatch.setattr(adapter.os, "close", failing_close)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    with pytest.raises(OSError, match="no space left on device"):
        ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=1)


RESIDUAL_EFFECTS = (
    "docker:residual_container",
    "docker:residual_network",
    "docker:residual_volume",
)


def residual_docker(responses):
    """A Docker adapter whose only scripted commands are the residual projections."""
    adapter = load_c8("adapter")
    plan = built_plan()
    log = fakes.CallLog()
    runner = fakes.FakeCommandRunner(
        log, {plan.commands[effect]: responses[effect] for effect in RESIDUAL_EFFECTS}
    )
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan, runner, fakes.FakeClock(log)
    )
    return docker, plan, log


def test_residual_observation_reports_container_network_and_volume_leftovers() -> None:
    """Teardown proof needs every created kind, not only the one `docker ps` can see.

    A network or a volume that survived teardown is exactly as much residue as a surviving
    container, and a residual inventory blind to two of the three kinds would report a
    leaked network as a clean host.
    """
    plan = built_plan()
    docker, _plan, log = residual_docker(
        {
            "docker:residual_container": fakes.FakeCommandResult(
                stdout=json.dumps(fakes.CONTAINER_NAME) + "\n"
            ),
            "docker:residual_network": fakes.FakeCommandResult(
                stdout=json.dumps(fakes.NETWORK_NAME) + "\n"
            ),
            "docker:residual_volume": fakes.FakeCommandResult(
                stdout=json.dumps(fakes.VOLUME_NAME) + "\n"
            ),
        }
    )
    assert docker.observe_residual() == (
        fakes.CONTAINER_NAME,
        fakes.NETWORK_NAME,
        fakes.VOLUME_NAME,
    )
    assert tuple(call["argv"] for call in log.calls("command.run")) == tuple(
        plan.commands[effect] for effect in RESIDUAL_EFFECTS
    )


def test_a_clean_teardown_reports_an_empty_residual_inventory() -> None:
    docker, _plan, _log = residual_docker(
        {effect: fakes.FakeCommandResult(stdout="") for effect in RESIDUAL_EFFECTS}
    )
    assert docker.observe_residual() == ()


@pytest.mark.parametrize("failing", RESIDUAL_EFFECTS)
@pytest.mark.parametrize(
    "result",
    (
        fakes.FakeCommandResult(returncode=1, stderr="cannot connect to the daemon\n"),
        fakes.FakeCommandResult(returncode=-9),
        fakes.FakeCommandResult(stdout="not-json\n"),
        fakes.FakeCommandResult(stdout="{}\n"),
        fakes.FakeCommandResult(stdout="123\n"),
        fakes.FakeCommandResult(stdout='""\n'),
    ),
)
def test_a_failed_or_malformed_residual_projection_is_unresolved_not_clean(
    failing: str, result
) -> None:
    """An unresolved residual observation must never read as an empty inventory.

    Each kind is broken in turn, because a check that only ever inspected the first
    projection would pass while a later one was silently failing.
    """
    docker, _plan, _log = residual_docker(
        {
            effect: (
                result
                if effect == failing
                else fakes.FakeCommandResult(stdout=json.dumps("leftover") + "\n")
            )
            for effect in RESIDUAL_EFFECTS
        }
    )
    assert docker.observe_residual() is None


# A deadline comfortably past the scripted clock reading, so the health observation is
# bounded by the runtime envelope rather than skipped as already expired.
HEALTH_DEADLINE = 1000.0

# Every observing seam, each reached through the one runner. A seam that promises `None`
# when it cannot answer must keep that promise for a result it cannot even parse.
UNRESOLVED_OBSERVATIONS = {
    "observe_controls": lambda ports, plan: ports["identities"].observe_controls(),
    "observe_image": lambda ports, plan: ports["host"].observe_image(
        reference=plan.image_reference
    ),
    "observe_ephemeral_range": lambda ports, plan: ports[
        "host"
    ].observe_ephemeral_range(),
    "observe_listeners": lambda ports, plan: ports["host"].observe_listeners(
        port=plan.host_port
    ),
    "observe_platform": lambda ports, plan: ports["docker"].observe_platform(),
    "observe_executable_digest": lambda ports, plan: ports[
        "docker"
    ].observe_executable_digest(path=fakes.DOCKER_EXECUTABLE_PATH),
    "observe_publications": lambda ports, plan: ports["docker"].observe_publications(
        port=plan.host_port
    ),
    "observe_health": lambda ports, plan: ports["docker"].observe_health(
        container=plan.container_name, deadline=HEALTH_DEADLINE
    ),
    "observe_container": lambda ports, plan: ports["docker"].observe_container(
        container=plan.container_name
    ),
    "observe_daemon_event": lambda ports, plan: ports["docker"].observe_daemon_event(
        container=plan.container_name
    ),
    "observe_docker_port": lambda ports, plan: ports["docker"].observe_docker_port(
        container=plan.container_name, container_port=plan.container_port_key
    ),
    "observe_network": lambda ports, plan: ports["docker"].observe_network(
        name=plan.network_name
    ),
    "observe_residual": lambda ports, plan: ports["docker"].observe_residual(),
    "observe_digest": lambda ports, plan: ports["probe"].observe_digest(
        path=plan.probe_executable_path
    ),
    "probe": lambda ports, plan: ports["probe"].run(
        executable=plan.probe_executable_path, argv=fakes.PROBE_ARGV
    ),
}


def observing_ports(plan, result):
    """Every command adapter, answering one exact result for every planned command."""
    adapter = load_c8("adapter")
    log = fakes.CallLog()
    runner = fakes.FakeCommandRunner(log, dict.fromkeys(plan.commands.values(), result))
    return {
        "identities": require_c8_attr(adapter, "ControlIdentityCommandAdapter")(
            plan, runner
        ),
        "host": require_c8_attr(adapter, "HostCommandAdapter")(plan, runner),
        "docker": require_c8_attr(adapter, "DockerCommandAdapter")(
            plan, runner, fakes.FakeClock(log)
        ),
        "probe": require_c8_attr(adapter, "ProbeCommandAdapter")(plan, runner),
    }


@pytest.mark.parametrize("result", fakes.MALFORMED_COMMAND_RESULTS)
@pytest.mark.parametrize("observation", sorted(UNRESOLVED_OBSERVATIONS))
def test_a_malformed_command_result_leaves_every_observation_unresolved(
    observation: str, result
) -> None:
    """A structurally wrong result is an observation nobody made, not a crash or a default.

    Each of these seams promises `None` when it cannot answer, and every caller branches on
    exactly that. A raised `AttributeError` has no `None` branch at the call site, and a
    `bool` status silently compared equal to `1` would let a broken `lsof` reading pass for
    the observed absence a pre-consumption check looks for.
    """
    plan = built_plan()
    ports = observing_ports(plan, result)
    assert UNRESOLVED_OBSERVATIONS[observation](ports, plan) is None


MUTATIONS = {
    "docker:create_network": lambda docker, plan: docker.create_network(
        name=plan.network_name, internal=True
    ),
    "docker:create_volume": lambda docker, plan: docker.create_volume(
        name=plan.volume_name
    ),
    "docker:create_container": lambda docker, plan: docker.create_container(
        name=plan.container_name,
        image=plan.image_reference,
        network=plan.network_name,
        volume=plan.volume_name,
        publish=fakes.PUBLISH_SPEC,
        pull=fakes.PULL_POLICY,
        environment={"POSTGRES_PASSWORD_FILE": fakes.CONTAINER_CREDENTIAL_PATH},
    ),
    "docker:start_container": lambda docker, plan: docker.start_container(
        name=plan.container_name
    ),
    "docker:remove_container": lambda docker, plan: docker.remove(
        kind="container", name=plan.container_name
    ),
    "docker:remove_network": lambda docker, plan: docker.remove(
        kind="network", name=plan.network_name
    ),
    "docker:remove_volume": lambda docker, plan: docker.remove(
        kind="volume", name=plan.volume_name
    ),
}


@pytest.mark.parametrize("effect", sorted(MUTATIONS))
@pytest.mark.parametrize(
    ("result", "reason"),
    (
        (fakes.FakeCommandResult(returncode=1, stderr="conflict\n"), "status 1"),
        (fakes.FakeCommandResult(returncode=125), "status 125"),
        # A negative status is the signal that killed the command: it did not run as
        # reviewed at all, which is not the same as running and failing cleanly.
        (fakes.FakeCommandResult(returncode=-9), "signal 9"),
        (fakes.FakeCommandResult(returncode=-15), "signal 15"),
        # The unresolved sentinel: a default-constructed result never executed at all.
        (fakes.FakeCommandResult(returncode=-1), "unresolved"),
        (SimpleNamespace(returncode=None, stdout="", stderr=""), "malformed"),
        (SimpleNamespace(returncode="0", stdout="", stderr=""), "malformed"),
        (SimpleNamespace(returncode=True, stdout="", stderr=""), "malformed"),
        (SimpleNamespace(returncode=0, stdout=None, stderr=""), "malformed"),
        (SimpleNamespace(stdout="", stderr=""), "malformed"),
    ),
)
def test_every_mutating_docker_command_refuses_a_result_that_is_not_a_clean_success(
    effect: str, result, reason: str
) -> None:
    """A mutating command that did not succeed may never be reported as if it had.

    Silently ignoring the status of a create, start or remove would let the rehearsal
    proceed against resources that do not exist, and would let a teardown that never
    removed anything be recorded as a completed teardown.
    """
    adapter = load_c8("adapter")
    plan = built_plan()
    log = fakes.CallLog()
    runner = fakes.FakeCommandRunner(log, {plan.commands[effect]: result})
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan, runner, fakes.FakeClock(log)
    )
    with pytest.raises(ValueError, match=reason):
        MUTATIONS[effect](docker, plan)


CREATED_ID = "created-id"

# What each mutation must hand back. A create names the object the daemon just made, so the
# runner can record that identifier as evidence; a start or a remove created nothing and
# must name nothing rather than echo whatever the command happened to print.
MUTATION_RETURNS = {
    "docker:create_network": CREATED_ID,
    "docker:create_volume": CREATED_ID,
    "docker:create_container": CREATED_ID,
    "docker:start_container": None,
    "docker:remove_container": None,
    "docker:remove_network": None,
    "docker:remove_volume": None,
}


@pytest.mark.parametrize("effect", sorted(MUTATIONS))
def test_a_clean_mutating_result_still_returns_the_daemons_own_identifier(
    effect: str,
) -> None:
    """Each mutation is pinned to its one answer, not to a choice between two.

    Accepting either the identifier or `None` for every mutation let a create that dropped
    the daemon's identifier pass exactly as well as one that returned it, which is the
    difference between recorded evidence and none.
    """
    adapter = load_c8("adapter")
    plan = built_plan()
    log = fakes.CallLog()
    runner = fakes.FakeCommandRunner(
        log, {plan.commands[effect]: fakes.FakeCommandResult(stdout=f"{CREATED_ID}\n")}
    )
    docker = require_c8_attr(adapter, "DockerCommandAdapter")(
        plan, runner, fakes.FakeClock(log)
    )
    assert MUTATIONS[effect](docker, plan) == MUTATION_RETURNS[effect]
    assert sorted(MUTATION_RETURNS) == sorted(MUTATIONS)
    assert log.count("command.run") == 1


@pytest.mark.parametrize(
    ("observed", "expected"),
    (
        (("net.inet.ip.portrange.first: 49152", "net.inet.ip.portrange.last: 65535"),
         (49152, 65535)),
        # A single reported bound is a partial reading, not a one-port range.
        (("net.inet.ip.portrange.first: 49152",), None),
        # A first bound at or above the last is degenerate: no reservation check can be
        # evaluated against it, so it is unresolved rather than a very small range.
        (("first: 49152", "last: 49152"), None),
        (("first: 65535", "last: 49152"), None),
        (("first: 1", "last: 2", "last: 3"), None),
        (("first: not-a-number", "last: 65535"), None),
    ),
)
def test_a_degenerate_or_partial_ephemeral_range_is_unresolved(
    observed: tuple[str, ...], expected
) -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    runner = fakes.FakeCommandRunner(
        fakes.CallLog(),
        {
            plan.commands["host:ephemeral_range"]: fakes.FakeCommandResult(
                stdout="".join(f"{line}\n" for line in observed)
            )
        },
    )
    host = require_c8_attr(adapter, "HostCommandAdapter")(plan, runner)
    assert host.observe_ephemeral_range() == expected


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
        except ValueError as error:
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


def test_attempt_ledger_refuses_to_follow_the_durable_path_symlink(tmp_path: Path) -> None:
    adapter = load_c8("adapter")
    target = tmp_path / "other-ledger"
    target.write_text(f"{fakes.RECORD_ID} 1\n", encoding="utf-8")
    ledger_path = tmp_path / "attempt-ledger"
    ledger_path.symlink_to(target)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    with pytest.raises(ValueError, match="symlink|refuses|unreadable"):
        ledger.is_consumed(record_id=fakes.RECORD_ID)


def test_attempt_ledger_refuses_a_fifo_without_blocking(
    tmp_path: Path, monkeypatch
) -> None:
    adapter = load_c8("adapter")
    ledger_path = tmp_path / "attempt-ledger"
    os.mkfifo(ledger_path, 0o600)
    real_open = adapter.os.open

    def nonblocking_open(path: str, flags: int, *args) -> int:
        if path == str(ledger_path):
            assert flags & adapter.os.O_NONBLOCK
        return real_open(path, flags, *args)

    monkeypatch.setattr(adapter.os, "open", nonblocking_open)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    with pytest.raises(ValueError, match="non-regular|regular file"):
        ledger.is_consumed(record_id=fakes.RECORD_ID)


def test_attempt_ledger_closes_a_nonregular_durable_path_descriptor(
    tmp_path: Path, monkeypatch
) -> None:
    adapter = load_c8("adapter")
    ledger_path = tmp_path / "attempt-ledger"
    ledger_path.mkdir()
    real_open = adapter.os.open
    opened: list[int] = []

    def recording_open(path: str, flags: int, *args) -> int:
        descriptor = real_open(path, flags, *args)
        if path == str(ledger_path):
            opened.append(descriptor)
        return descriptor

    monkeypatch.setattr(adapter.os, "open", recording_open)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    with pytest.raises(ValueError, match="non-regular|regular file"):
        ledger.is_consumed(record_id=fakes.RECORD_ID)
    assert len(opened) == 1
    with pytest.raises(OSError):
        adapter.os.fstat(opened[0])


def test_attempt_ledger_recovers_a_regular_stale_pending_file_under_lock(
    tmp_path: Path, monkeypatch
) -> None:
    adapter = load_c8("adapter")
    ledger_path = tmp_path / "attempt-ledger"
    pending = tmp_path / "attempt-ledger.pending"
    pending.write_text("orphaned partial state\n", encoding="utf-8")
    pending.chmod(0o600)
    os.utime(pending, (0, 0))
    sleeps: list[float] = []
    monkeypatch.setattr(adapter.time, "sleep", sleeps.append)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=1)
    assert ledger_path.read_text(encoding="utf-8") == f"{fakes.RECORD_ID} 1\n"
    assert not pending.exists()
    assert sleeps == []


def test_attempt_ledger_preserves_a_recent_pending_file_after_bounded_wait(
    tmp_path: Path, monkeypatch
) -> None:
    adapter = load_c8("adapter")
    ledger_path = tmp_path / "attempt-ledger"
    pending = tmp_path / "attempt-ledger.pending"
    pending.write_text("possibly live state\n", encoding="utf-8")
    pending.chmod(0o600)
    sleeps: list[float] = []
    monkeypatch.setattr(adapter.time, "sleep", sleeps.append)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    with pytest.raises(ValueError, match="still held|in flight|recent"):
        ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=1)
    assert pending.read_text(encoding="utf-8") == "possibly live state\n"
    assert len(sleeps) == adapter.LEDGER_LOCK_ATTEMPTS


def test_attempt_ledger_refuses_a_symlink_at_the_pending_path(
    tmp_path: Path, monkeypatch
) -> None:
    adapter = load_c8("adapter")
    ledger_path = tmp_path / "attempt-ledger"
    target = tmp_path / "do-not-delete"
    target.write_text("owned elsewhere\n", encoding="utf-8")
    pending = tmp_path / "attempt-ledger.pending"
    pending.symlink_to(target)
    sleeps: list[float] = []
    monkeypatch.setattr(adapter.time, "sleep", sleeps.append)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    with pytest.raises(ValueError, match="symlink|non-regular"):
        ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=1)
    assert pending.is_symlink()
    assert target.read_text(encoding="utf-8") == "owned elsewhere\n"
    assert sleeps == []


def test_ledger_fsyncs_the_file_and_containing_directory(
    tmp_path: Path, monkeypatch
) -> None:
    adapter = load_c8("adapter")
    events: list[str] = []
    real_fsync = adapter.os.fsync
    real_replace = adapter.os.replace

    def recording_fsync(file_descriptor: int) -> None:
        mode = adapter.os.fstat(file_descriptor).st_mode
        events.append("fsync:directory" if stat.S_ISDIR(mode) else "fsync:file")
        real_fsync(file_descriptor)

    def recording_replace(source: str, destination: str) -> None:
        events.append("replace")
        real_replace(source, destination)

    monkeypatch.setattr(adapter.os, "fsync", recording_fsync)
    monkeypatch.setattr(adapter.os, "replace", recording_replace)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(
        str(tmp_path / "attempt-ledger")
    )
    ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=1)
    assert "fsync:file" in events
    assert "replace" in events
    assert "fsync:directory" in events
    assert events.index("fsync:file") < events.index("replace")
    assert events.index("replace") < events.index("fsync:directory")


def test_post_replace_fsync_failure_does_not_delete_another_consumers_pending(
    tmp_path: Path, monkeypatch
) -> None:
    adapter = load_c8("adapter")
    ledger_path = tmp_path / "attempt-ledger"
    pending = tmp_path / "attempt-ledger.pending"

    def fail_after_replacement(_directory: str) -> None:
        pending.write_text("new consumer owns this pending file\n", encoding="utf-8")
        raise OSError("directory fsync failed")

    monkeypatch.setattr(adapter, "fsync_directory", fail_after_replacement)
    ledger = require_c8_attr(adapter, "AtomicFileAttemptLedger")(str(ledger_path))
    with pytest.raises(OSError, match="directory fsync failed"):
        ledger.consume(record_id=fakes.RECORD_ID, attempt_ordinal=1)
    assert ledger_path.read_text(encoding="utf-8") == f"{fakes.RECORD_ID} 1\n"
    assert pending.read_text(encoding="utf-8") == (
        "new consumer owns this pending file\n"
    )


def test_credential_adapter_is_plan_bound_and_fsyncs_its_directory(monkeypatch) -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    credential_type = require_c8_attr(adapter, "CredentialFileAdapter")
    assert tuple(inspect.signature(credential_type).parameters) == ("plan",)
    opened: list[tuple[str, int, int | None]] = []
    fsynced: list[int] = []
    closed: list[int] = []

    def fake_open(path: str, flags: int, mode: int | None = None) -> int:
        opened.append((path, flags, mode))
        return 10 if path == plan.credential_path else 11

    monkeypatch.setattr(adapter.os, "getuid", lambda: 1234)
    monkeypatch.setattr(
        adapter.os,
        "lstat",
        lambda _path: SimpleNamespace(st_mode=stat.S_IFDIR | 0o700, st_uid=1234),
    )
    monkeypatch.setattr(adapter.os, "open", fake_open)
    monkeypatch.setattr(adapter.os, "write", lambda descriptor, data: len(data))
    monkeypatch.setattr(adapter.os, "fsync", fsynced.append)
    monkeypatch.setattr(adapter.os, "close", closed.append)
    credential = credential_type(plan)
    assert credential.create(name=plan.credential_name) == plan.credential_path
    assert opened[0][0] == plan.credential_path
    assert any(path == fakes.CREDENTIAL_DIRECTORY for path, _flags, _mode in opened)
    assert fsynced == [10, 11]
    assert closed == [10, 11]
    with pytest.raises(ValueError):
        credential.create(name="wrong-credential")
    with pytest.raises(ValueError):
        credential.remove(name="wrong-credential")
    with pytest.raises(ValueError):
        credential.observe_residual(name="wrong-credential")


@pytest.mark.parametrize(
    ("mode", "owner", "reason"),
    (
        (stat.S_IFLNK | 0o700, 1234, "directory"),
        (stat.S_IFREG | 0o600, 1234, "directory"),
        (stat.S_IFDIR | 0o700, 4321, "owner"),
        (stat.S_IFDIR | 0o720, 1234, "writable"),
        (stat.S_IFDIR | 0o702, 1234, "writable"),
    ),
)
def test_credential_adapter_refuses_an_untrusted_parent_before_write(
    monkeypatch, mode: int, owner: int, reason: str
) -> None:
    adapter = load_c8("adapter")
    plan = built_plan()
    monkeypatch.setattr(adapter.os, "getuid", lambda: 1234)
    monkeypatch.setattr(
        adapter.os,
        "lstat",
        lambda _path: SimpleNamespace(st_mode=mode, st_uid=owner),
    )
    monkeypatch.setattr(
        adapter.os,
        "open",
        lambda *_args, **_kwargs: pytest.fail("untrusted parent reached os.open"),
    )
    credential = require_c8_attr(adapter, "CredentialFileAdapter")(plan)
    with pytest.raises(ValueError, match=reason):
        credential.create(name=plan.credential_name)


def test_credential_adapter_refuses_a_missing_parent_before_write(monkeypatch) -> None:
    adapter = load_c8("adapter")
    plan = built_plan()

    def missing_parent(_path: str):
        raise FileNotFoundError("missing")

    monkeypatch.setattr(adapter.os, "lstat", missing_parent)
    monkeypatch.setattr(
        adapter.os,
        "open",
        lambda *_args, **_kwargs: pytest.fail("missing parent reached os.open"),
    )
    credential = require_c8_attr(adapter, "CredentialFileAdapter")(plan)
    with pytest.raises(ValueError, match="directory|missing"):
        credential.create(name=plan.credential_name)


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
