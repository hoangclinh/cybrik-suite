"""The complete one-attempt lifecycle, classification and teardown specification."""

from __future__ import annotations

import ast
import dataclasses
import inspect
import re
from collections.abc import Mapping

import pytest

import fakes
import documents
from conftest import PACKAGE, SRC, load_c8, require_c8_attr, require_c8_path


CREATE_CALLS = (
    "docker.create_network",
    "docker.create_volume",
    "credential.create",
    "docker.create_container",
    "docker.start_container",
)


@pytest.fixture(name="runner")
def runner_module():
    return load_c8("runner")


def run(runner, adapters=None, authorization=None, execute_requested=True):
    return require_c8_attr(runner, "run_topology_rehearsal")(
        authorization or documents.authorization(),
        adapters or fakes.passing_adapters(),
        execute_requested=execute_requested,
    )


def test_clean_fake_lifecycle_returns_topology_pass_with_evidence(runner) -> None:
    adapters = fakes.passing_adapters()
    result = run(runner, adapters)
    assert result.outcome == fakes.TOPOLOGY_PASS
    assert result.attempt_consumed is True
    assert result.teardown_complete is True
    assert result.residuals == ()
    assert result.evidence["publication_views"]
    assert result.evidence["probe"]["result"] == "reachable"


def test_attempt_is_consumed_immediately_before_the_first_create_mutation(runner) -> None:
    adapters = fakes.passing_adapters()
    run(runner, adapters)
    names = adapters.log.names()
    consume = names.index("ledger.consume")
    first_create = min(names.index(name) for name in CREATE_CALLS)
    assert first_create == consume + 1
    assert names[first_create] == "docker.create_network"


def test_creation_is_exactly_network_volume_credential_container_start_once(runner) -> None:
    adapters = fakes.passing_adapters()
    run(runner, adapters)
    assert tuple(name for name in adapters.log.names() if name in CREATE_CALLS) == CREATE_CALLS
    assert all(adapters.log.count(name) == 1 for name in CREATE_CALLS)


def test_container_arguments_keep_internal_network_pull_never_and_loopback_only(runner) -> None:
    adapters = fakes.passing_adapters()
    run(runner, adapters)
    call = adapters.log.calls("docker.create_container")[0]
    assert call["image"] == f"postgres@{fakes.SYNTHETIC_MANIFEST_DIGEST}"
    assert call["image"] != fakes.IMAGE_REFERENCE
    assert call["network"] == fakes.NETWORK_NAME
    assert call["volume"] == fakes.VOLUME_NAME
    assert call["publish"] == fakes.PUBLISH_SPEC
    assert call["pull"] == fakes.PULL_POLICY
    assert call["environment"] == {
        "POSTGRES_PASSWORD_FILE": fakes.CONTAINER_CREDENTIAL_PATH
    }
    assert adapters.log.count("docker.start_container") == 1
    assert adapters.log.calls("docker.start_container")[0]["name"] == fakes.CONTAINER_NAME


def test_every_post_consumption_path_tears_down_all_resources_and_rechecks_absence(
    runner,
) -> None:
    adapters = fakes.passing_adapters()
    run(runner, adapters)
    removals = adapters.log.calls("docker.remove")
    assert tuple(item["kind"] for item in removals) == ("container", "network", "volume")
    assert adapters.log.count("credential.remove") == 1
    names = adapters.log.names()
    assert names.index("credential.remove") > names.index("docker.remove")
    assert names[-3:] == (
        "docker.observe_residual",
        "credential.observe_residual",
        "host.observe_listeners",
    )
    assert adapters.log.count("host.observe_listeners") == 3


@pytest.mark.parametrize(
    "adapters",
    [
        lambda: fakes.passing_adapters(identities=None),
        lambda: fakes.passing_adapters(image=None),
        lambda: fakes.passing_adapters(ephemeral_range=None),
        lambda: fakes.passing_adapters(probe_digest=None),
        lambda: fakes.passing_adapters(docker_digest=None),
        lambda: fakes.passing_adapters(consumed=(fakes.RECORD_ID,)),
        lambda: fakes.passing_adapters(verdict=False),
    ],
)
def test_preconsumption_failure_is_precheck_abort_with_zero_create_or_teardown(
    runner, adapters
) -> None:
    current = adapters()
    result = run(runner, current)
    assert result.outcome == fakes.PRECHECK_ABORT
    assert result.attempt_consumed is False
    assert not set(current.log.names()) & set(CREATE_CALLS)
    assert current.log.count("docker.remove") == 0


def test_no_exact_execute_request_is_hold_with_zero_observation(runner) -> None:
    adapters = fakes.passing_adapters()
    result = run(runner, adapters, execute_requested=False)
    assert result.outcome == fakes.PRECHECK_ABORT
    assert result.attempt_consumed is False
    assert adapters.log.entries == ()


def test_creation_failure_is_stop_control_and_still_tears_down(runner) -> None:
    adapters = fakes.passing_adapters(create_failure=RuntimeError("synthetic create failure"))
    result = run(runner, adapters)
    assert result.outcome == fakes.STOP_CONTROL
    assert result.attempt_consumed
    assert tuple(item["kind"] for item in adapters.log.calls("docker.remove")) == (
        "container",
        "network",
        "volume",
    )
    assert adapters.log.count("credential.remove") == 1


@pytest.mark.parametrize(
    "adapters",
    [
        lambda: fakes.passing_adapters(daemon_event="0.0.0.0:15433"),
        lambda: fakes.passing_adapters(docker_port=":::15433"),
        lambda: fakes.passing_adapters(
            container=fakes.container_projection(bindings={})
        ),
        lambda: fakes.passing_adapters(
            listeners=((), (fakes.WILDCARD_LISTENER,), ())
        ),
    ],
)
def test_any_publication_projection_drift_is_fail_publication(runner, adapters) -> None:
    result = run(runner, adapters())
    assert result.outcome == fakes.FAIL_PUBLICATION
    assert result.teardown_complete


@pytest.mark.parametrize(
    "adapters",
    [
        lambda: fakes.passing_adapters(probe_result=None),
        lambda: fakes.passing_adapters(probe_result="refused"),
    ],
)
def test_healthy_exact_publication_with_failed_probe_is_fail_internal_ingress(
    runner, adapters
) -> None:
    result = run(runner, adapters())
    assert result.outcome == fakes.FAIL_INTERNAL_INGRESS
    assert result.teardown_complete


@pytest.mark.parametrize(
    "adapters",
    [
        lambda: fakes.passing_adapters(health=(None,)),
        lambda: fakes.passing_adapters(health=("unhealthy",)),
        lambda: fakes.passing_adapters(network=fakes.network_projection(internal=False)),
        lambda: fakes.passing_adapters(
            network=fakes.network_projection(containers={"one": {}, "two": {}})
        ),
        lambda: fakes.passing_adapters(credential_residual=True),
        lambda: fakes.passing_adapters(
            listeners=((), (fakes.LOOPBACK_LISTENER,), (fakes.LOOPBACK_LISTENER,))
        ),
    ],
)
def test_health_scope_network_or_teardown_invariant_failure_is_stop_control(
    runner, adapters
) -> None:
    result = run(runner, adapters())
    assert result.outcome == fakes.STOP_CONTROL
    assert result.attempt_consumed


class TwoFacedNetwork(Mapping):
    """A network projection that answers `.get()` and its own iteration differently.

    An adapter is outside this package's trust boundary, so a projection it hands back may
    answer the reads the verdict makes and the reads the receipt makes with two different
    networks. This is the smallest such value: `.get()` reports the isolated network the
    verdict would admit, while iteration — what any copy of it is built from — reports a
    network with a route off the host.
    """

    def __init__(self, judged: dict, recorded: dict) -> None:
        self._judged = dict(judged)
        self._recorded = dict(recorded)

    def __getitem__(self, key: str):
        return self._recorded[key]

    def __iter__(self):
        return iter(self._recorded)

    def __len__(self) -> int:
        return len(self._recorded)

    def get(self, key: str, default=None):
        return self._judged.get(key, default)


def test_the_recorded_network_projection_is_the_reading_the_verdict_judged(
    runner,
) -> None:
    """One reading is judged and recorded, so no receipt can contradict its own verdict."""
    observe = load_c8("observe")
    revalidate = require_c8_attr(observe, "validate_internal_network")
    network = TwoFacedNetwork(
        judged=fakes.network_projection(),
        recorded=fakes.network_projection(internal=False),
    )
    result = run(runner, fakes.passing_adapters(network=network))
    recorded = result.evidence["network_attachment"]
    assert revalidate(recorded).satisfied is (result.outcome == fakes.TOPOLOGY_PASS)


class DriftingProbeResult:
    """A probe result whose first comparison answers reachable and whose later ones do not.

    `validate_internal_ingress` judges this reading by `==` exactly once, and the evidence
    bundle then records the reading itself rather than a copy of it. A live object is free
    to answer the verdict's one comparison and every later reader differently, so this is
    the smallest reading that is reachable to the control and unreachable in the receipt
    the control is printed beside.
    """

    def __init__(self, judged: str, recorded: str) -> None:
        self._answers = [judged, recorded]

    def _answer(self) -> str:
        return self._answers.pop(0) if len(self._answers) > 1 else self._answers[0]

    def __eq__(self, other: object) -> bool:
        return self._answer() == other

    def __hash__(self) -> int:
        return 0

    def __repr__(self) -> str:
        return "<drifting probe result>"


def test_the_recorded_probe_result_is_the_reading_the_ingress_verdict_judged(
    runner,
) -> None:
    """One probe reading is judged and recorded, so the receipt cannot contradict it."""
    observe = load_c8("observe")
    constants = load_c8("constants")
    revalidate = require_c8_attr(observe, "validate_internal_ingress")
    healthy = require_c8_attr(constants, "HEALTH_HEALTHY")
    reachable = require_c8_attr(constants, "PROBE_REACHABLE")
    adapters = fakes.passing_adapters(
        probe_result=DriftingProbeResult(judged=reachable, recorded="refused")
    )
    result = run(runner, adapters)
    recorded = result.evidence["probe"]["result"]
    assert revalidate(healthy, recorded).satisfied is (
        result.outcome == fakes.TOPOLOGY_PASS
    )


class TwoFacedBindings(Mapping):
    """Port bindings that iterate as the reviewed key alone while storing a second one.

    `binding_publication` checks the whole key inventory through `__iter__` and then reads
    the reviewed entry through `.get`. A live projection may answer those two protocols
    about two different containers. This is the smallest such value: iteration reports only
    the reviewed publication, while what the mapping stores — the read every copy and every
    receipt in this package is built from — carries a second, unreviewed publication.
    """

    def __init__(self, reviewed: dict, extra: dict) -> None:
        self._iterated = dict(reviewed)
        self._stored = {**reviewed, **extra}

    def __getitem__(self, key: str):
        return self._stored[key]

    def __iter__(self):
        return iter(self._iterated)

    def __len__(self) -> int:
        return len(self._stored)

    def items(self):
        return self._stored.items()


def test_a_container_storing_a_second_publication_cannot_pass_the_binding_inventory(
    runner,
) -> None:
    """The inventory control judges the bindings the container stores, not another view."""
    observe = load_c8("observe")
    resolve = require_c8_attr(observe, "binding_publication")
    reviewed = {fakes.CONTAINER_PORT_KEY: [{"HostIp": fakes.HOST_IP, "HostPort": "15433"}]}
    bindings = TwoFacedBindings(
        reviewed=reviewed,
        extra={"5433/tcp": [{"HostIp": "0.0.0.0", "HostPort": "15434"}]},
    )
    adapters = fakes.passing_adapters(
        container=fakes.container_projection(bindings=bindings)
    )
    result = run(runner, adapters)
    stored_view = resolve(dict(bindings.items()))
    assert result.evidence["publication_views"]["host_config_port_bindings"] == stored_view
    assert (result.outcome == fakes.TOPOLOGY_PASS) is (stored_view is not None)


def test_publication_failure_outranks_internal_ingress_failure(runner) -> None:
    adapters = fakes.passing_adapters(
        daemon_event="0.0.0.0:15433",
        probe_result="refused",
    )
    assert run(runner, adapters).outcome == fakes.FAIL_PUBLICATION


@pytest.mark.parametrize(
    ("adapters", "outranked"),
    [
        (
            lambda: fakes.passing_adapters(
                residual=(fakes.NETWORK_NAME,), daemon_event="0.0.0.0:15433"
            ),
            fakes.FAIL_PUBLICATION,
        ),
        (
            lambda: fakes.passing_adapters(
                credential_residual=True, probe_result="refused"
            ),
            fakes.FAIL_INTERNAL_INGRESS,
        ),
        (
            lambda: fakes.passing_adapters(
                network=fakes.network_projection(internal=False),
                daemon_event="0.0.0.0:15433",
                probe_result="refused",
            ),
            fakes.FAIL_PUBLICATION,
        ),
    ],
)
def test_a_control_failure_outranks_every_weaker_topology_verdict(
    runner, adapters, outranked: str
) -> None:
    """`STOP_CONTROL` sits above both topology failures in the fixed precedence."""
    precedence = fakes.OUTCOME_PRECEDENCE
    assert precedence.index(fakes.STOP_CONTROL) < precedence.index(outranked)
    result = run(runner, adapters())
    assert result.outcome == fakes.STOP_CONTROL


@pytest.mark.parametrize(
    "adapters",
    [
        lambda: fakes.passing_adapters(daemon_event="0.0.0.0:15433"),
        lambda: fakes.passing_adapters(probe_result="refused"),
        lambda: fakes.passing_adapters(health=("unhealthy",)),
        lambda: fakes.passing_adapters(residual=(fakes.NETWORK_NAME,)),
    ],
)
def test_every_failing_post_consumption_path_still_tears_down_all_four_resources(
    runner, adapters
) -> None:
    """Teardown is unconditional after consumption, whatever the terminal class is."""
    current = adapters()
    result = run(runner, current)
    assert result.outcome != fakes.TOPOLOGY_PASS
    assert result.attempt_consumed is True
    assert tuple(item["kind"] for item in current.log.calls("docker.remove")) == (
        "container",
        "network",
        "volume",
    )
    assert current.log.count("credential.remove") == 1
    names = current.log.names()
    assert names.index("credential.remove") > names.index("docker.remove")
    assert current.log.count("docker.observe_residual") == 1
    assert current.log.count("credential.observe_residual") == 1


def test_180_second_envelope_has_zero_extension_and_overrun_is_stop_control(runner) -> None:
    adapters = fakes.passing_adapters(ticks=(0.0, 181.0, 181.0, 181.0))
    result = run(runner, adapters)
    assert result.outcome == fakes.STOP_CONTROL
    assert result.evidence["timings"]["extension_cycles"] == 0
    assert result.teardown_complete


def test_the_health_wait_deadline_is_the_one_envelope_read_from_the_clock(runner) -> None:
    """Every bounded wait shares one deadline derived from the first monotonic reading."""
    adapters = fakes.passing_adapters()
    run(runner, adapters)
    ticks = adapters.log.calls("clock.monotonic")
    assert ticks, "the runner must read its own elapsed-time source"
    names = adapters.log.names()
    assert names.index("clock.monotonic") < names.index("docker.create_network")
    deadlines = {call["deadline"] for call in adapters.log.calls("docker.observe_health")}
    assert deadlines == {ticks[0]["value"] + fakes.RUNTIME_LIMIT_SECONDS}


def test_any_residual_resource_upgrades_the_outcome_to_stop_control(runner) -> None:
    adapters = fakes.passing_adapters(residual=(fakes.NETWORK_NAME,))
    result = run(runner, adapters)
    assert result.outcome == fakes.STOP_CONTROL
    assert result.residuals == (fakes.NETWORK_NAME,)


def test_runner_exports_the_result_the_entrypoint_and_the_attempt_identity_seam(
    runner,
) -> None:
    """Three names, and the third is a seam rather than a second way in.

    `attempt_id_for` is exported because the composition root has to name the same attempt
    the runner will name, and it holds no `PreparationResult` to reach `_attempt_names`
    with. An unexported formula leaves the wiring re-rendering the same identity from the
    same field, which is agreement by convention across a module boundary rather than by
    construction — the defect class that already cost one repair.
    """
    assert set(require_c8_attr(runner, "__all__")) == {
        "RehearsalResult",
        "attempt_id_for",
        "run_topology_rehearsal",
    }


# The nine mandatory `GrantFacts` members. Each one must reach admission from a source that
# is independent of the grant being verified: the loader observations on the authorization
# envelope, the preparation phase's host observations, or the reviewed constants. The grant
# is the document under test, so it is never a source for the facts that test it.
FACT_NAMES = (
    "record_path",
    "record_sha256",
    "runner_aggregate_sha256",
    "topology",
    "selected_image_identity",
    "observed_image_identity",
    "repositories",
    "tools",
    "now",
)
HOST_OBSERVED_SELECTION_KEYS = (
    "repository",
    "tag",
    "platform",
    "index_digest",
    "manifest_digest",
)


def assert_refused_before_any_mutation(result, adapters) -> None:
    """A fact-source disagreement is a precheck refusal: nothing was created or torn down."""
    assert result.outcome == fakes.PRECHECK_ABORT
    assert result.attempt_consumed is False
    assert not set(adapters.log.names()) & set(CREATE_CALLS)
    assert adapters.log.count("docker.remove") == 0
    assert adapters.log.count("credential.remove") == 0
    assert adapters.log.count("ledger.consume") == 0


def test_the_runner_aggregate_fact_is_the_loader_digest_not_the_granted_one(
    runner,
) -> None:
    adapters = fakes.passing_adapters()
    result = run(
        runner,
        adapters,
        authorization=documents.authorization(runner_aggregate_sha256="5" * 64),
    )
    assert_refused_before_any_mutation(result, adapters)


def test_the_now_fact_is_the_loader_instant_not_a_moment_read_off_the_window(
    runner,
) -> None:
    adapters = fakes.passing_adapters()
    result = run(
        runner,
        adapters,
        authorization=documents.authorization(
            observed_at=documents.NOW_AFTER_EXPIRES_AT
        ),
    )
    assert_refused_before_any_mutation(result, adapters)


@pytest.mark.parametrize("name", ("runner_aggregate_sha256", "observed_at"))
@pytest.mark.parametrize("value", (None, "", 0))
def test_an_unobserved_loader_fact_is_a_refusal_never_a_fallback_to_the_grant(
    runner, name, value
) -> None:
    adapters = fakes.passing_adapters()
    result = run(
        runner, adapters, authorization=documents.authorization(**{name: value})
    )
    assert_refused_before_any_mutation(result, adapters)


def test_the_evidence_records_the_exact_nine_facts_the_attempt_observed(runner) -> None:
    adapters = fakes.passing_adapters()
    authorization = documents.authorization()
    result = run(runner, adapters, authorization=authorization)
    facts = result.evidence["facts"]
    assert set(facts) == set(FACT_NAMES)
    assert facts["record_path"] == authorization.record_path
    assert facts["record_sha256"] == authorization.record_sha256
    assert facts["runner_aggregate_sha256"] == authorization.runner_aggregate_sha256
    assert facts["now"] == authorization.observed_at


def test_the_topology_fact_is_the_reviewed_constant_not_the_granted_section(
    runner,
) -> None:
    adapters = fakes.passing_adapters()
    result = run(runner, adapters)
    assert result.evidence["facts"]["topology"] == {
        "host_ip": fakes.HOST_IP,
        "host_port": fakes.HOST_PORT,
        "container_port": fakes.CONTAINER_PORT,
        "protocol": fakes.PORT_PROTOCOL,
        "internal_network": True,
        "publish_spec": fakes.PUBLISH_SPEC,
    }


def test_selected_image_identity_is_the_host_observation_plus_the_reviewed_policy(
    runner,
) -> None:
    adapters = fakes.passing_adapters()
    result = run(runner, adapters)
    observed = fakes.host_image()
    selected = result.evidence["facts"]["selected_image_identity"]
    assert set(selected) == set(documents.SELECTED_IDENTITY_KEYS)
    assert selected["pull_policy"] == fakes.PULL_POLICY
    for key in HOST_OBSERVED_SELECTION_KEYS:
        assert selected[key] == observed[key]


def test_the_observed_facts_are_the_preparation_observations(runner) -> None:
    adapters = fakes.passing_adapters()
    result = run(runner, adapters)
    facts = result.evidence["facts"]
    observed = fakes.host_image()
    assert facts["observed_image_identity"]["local_image_id"] == observed["local_image_id"]
    assert facts["observed_image_identity"]["observed_at"] == observed["observed_at"]
    assert set(facts["repositories"]) == set(fakes.EXPECTED_CONTROLS)
    assert facts["tools"]["docker"]["sha256"] == fakes.SYNTHETIC_DOCKER_SHA256
    assert facts["tools"]["probe"]["sha256"] == fakes.PROBE_EXECUTABLE_SHA256
    assert tuple(facts["tools"]["probe"]["argv"]) == fakes.PROBE_ARGV


class FailingClock:
    """A clock that answers `answers` readings and then stops answering.

    The envelope takes exactly two readings: one before the ledger is consumed and one
    after the attempt is consumed and all five resources exist. Scripting a failure at
    each of those instants is what separates "the envelope is guarded" from "the envelope
    is guarded whenever nothing unexpected happened on the way to it" — the shipped
    `MonotonicClock` wraps a bare `time.monotonic()` that cannot raise, and the scripted
    fake repeats its last tick, so neither of them can reach either path.
    """

    def __init__(self, log, answers: int = 1, opening: float = 0.0) -> None:
        self._log = log
        self._answers = answers
        self._opening = opening
        self._readings = 0

    def monotonic(self) -> float:
        self._readings += 1
        if self._readings <= self._answers:
            self._log.record("clock.monotonic", value=self._opening)
            return self._opening
        raise OSError("the monotonic clock stopped answering")


def test_a_clock_that_fails_before_consumption_refuses_without_mutating(runner) -> None:
    """An unreadable opening instant is a precheck refusal, not an unbounded attempt.

    The opening reading is what fixes the one deadline. Without it there is no envelope
    to run inside, so the attempt may not be consumed and no resource may be created.
    A raising clock here escaped `run_topology_rehearsal` as an `OSError` instead.
    """
    base = fakes.passing_adapters()
    adapters = dataclasses.replace(base, clock=FailingClock(base.log, answers=0))

    result = run(runner, adapters)

    # The call returns a terminal refusal rather than propagating the clock's failure.
    assert result.outcome == fakes.PRECHECK_ABORT
    assert result.attempt_consumed is False
    # Nothing was consumed, created or torn down: the ledger still holds the one attempt.
    assert adapters.log.count("ledger.consume") == 0
    for name in CREATE_CALLS:
        assert adapters.log.count(name) == 0
    assert adapters.log.count("docker.remove") == 0
    assert adapters.log.count("credential.remove") == 0
    assert result.teardown_complete is False
    assert result.residuals == ()
    # The refusal names the unreadable clock rather than a generic precheck failure.
    assert any("clock" in finding for finding in result.findings)


def test_a_clock_that_fails_after_creation_still_tears_the_attempt_down(runner) -> None:
    """An unreadable completion instant may not strand a consumed attempt's resources.

    Every other injected seam between consumption and teardown is guarded. The completion
    reading was not, so a raising clock escaped `run_topology_rehearsal` with the network,
    volume, credential and container still on the host and the ledger already consumed.
    """
    base = fakes.passing_adapters()
    adapters = dataclasses.replace(base, clock=FailingClock(base.log))

    result = run(runner, adapters)

    # The call returns a terminal answer rather than propagating the clock's failure.
    assert result.attempt_consumed is True
    assert result.outcome == fakes.STOP_CONTROL
    # Teardown was still reached: the host is not left holding what the attempt created.
    assert adapters.log.count("docker.remove") == len(fakes.TEARDOWN_KINDS) - 1
    assert adapters.log.count("credential.remove") == 1
    assert result.teardown_complete is True
    assert result.residuals == ()
    # The refusal names the unreadable clock rather than reporting a clean envelope.
    assert any("clock" in finding for finding in result.findings)


class MalformedClock:
    """A clock that answers `answers` genuine readings, then answers with `reading` forever.

    `_guarded_clock` only ever catches an exception; it never inspects what a clock that
    returns *without* raising actually handed back. A clock reading is only useful when it is
    a real, finite number. `"soon"`, `None` and an opaque object blow up the very next
    arithmetic or comparison the runner performs on the value (`started + RUNTIME_LIMIT_SECONDS`
    or `completed > deadline`), the same way `FailingClock` above blows up by raising. A `bool`
    — an `int` subclass that is not a clock reading — and a non-finite float (`nan`, `inf`)
    are worse: the arithmetic and comparison both survive them without raising, so they slip
    through as a silently wrong answer instead of a crash. Both failure shapes are the same
    unguarded seam.
    """

    def __init__(
        self, log, reading: object, *, answers: int = 1, opening: float = 0.0
    ) -> None:
        self._log = log
        self._reading = reading
        self._answers = answers
        self._opening = opening
        self._readings = 0

    def monotonic(self) -> object:
        self._readings += 1
        if self._readings <= self._answers:
            self._log.record("clock.monotonic", value=self._opening)
            return self._opening
        self._log.record("clock.monotonic", value=self._reading)
        return self._reading


# Every shape of "not a real finite number" the guard must classify exactly like a raising
# clock. `bool` and the non-finite floats are the arithmetic-tolerant shapes: they do not
# raise, so a guard that only catches exceptions lets them through as a wrong answer.
NON_READING_CLOCK_VALUES = (
    pytest.param("soon", id="a-string"),
    pytest.param(None, id="none"),
    pytest.param(object(), id="an-opaque-object"),
    pytest.param(True, id="a-bool"),
    pytest.param(float("nan"), id="nan"),
    pytest.param(float("inf"), id="infinity"),
)


@pytest.mark.parametrize("reading", NON_READING_CLOCK_VALUES)
def test_a_clock_that_answers_with_a_non_reading_before_consumption_refuses_without_mutating(
    runner, reading
) -> None:
    """An opening reading that is not a real finite number may not fix the envelope either.

    The opening reading is what fixes the one deadline, exactly as in the raising-clock test
    above. A clock that answers `"soon"`, `None` or an opaque object without raising crashes
    the very next line (`started + RUNTIME_LIMIT_SECONDS`) with an unguarded `TypeError`. A
    clock that answers `True`, `nan` or `inf` is worse: that arithmetic succeeds, so nothing
    stops the attempt from being consumed and the resources from being created on a deadline
    that was never a real instant.
    """
    base = fakes.passing_adapters()
    adapters = dataclasses.replace(
        base, clock=MalformedClock(base.log, reading, answers=0)
    )

    result = run(runner, adapters)

    # The call returns a terminal refusal rather than propagating or mutating on a bad reading.
    assert result.outcome == fakes.PRECHECK_ABORT
    assert result.attempt_consumed is False
    # Nothing was consumed, created or torn down: the ledger still holds the one attempt.
    assert adapters.log.count("ledger.consume") == 0
    for name in CREATE_CALLS:
        assert adapters.log.count(name) == 0
    assert adapters.log.count("docker.remove") == 0
    assert adapters.log.count("credential.remove") == 0
    assert result.teardown_complete is False
    assert result.residuals == ()
    # The refusal names the unusable clock rather than a generic precheck failure.
    assert any("clock" in finding for finding in result.findings)


@pytest.mark.parametrize("reading", NON_READING_CLOCK_VALUES)
def test_a_clock_that_answers_with_a_non_reading_after_creation_still_tears_the_attempt_down(
    runner, reading
) -> None:
    """A completion reading that is not a real finite number is a finding, never a crash.

    Every other injected seam between consumption and teardown is guarded by structure, not
    by whether the value happens to survive the next line. A clock that answers `"soon"`,
    `None` or an opaque object for its completion reading crashes `completed > deadline` with
    an unguarded `TypeError` and stops teardown from ever running. A clock that answers
    `True`, `nan` or `inf` is worse: that comparison survives and answers cleanly, so the
    attempt is reported as a clean envelope instead of the unreadable one it actually is.
    """
    base = fakes.passing_adapters()
    adapters = dataclasses.replace(base, clock=MalformedClock(base.log, reading))

    result = run(runner, adapters)

    # The call returns a terminal answer rather than propagating the clock's bad reading.
    assert result.attempt_consumed is True
    assert result.outcome == fakes.STOP_CONTROL
    # Teardown was still reached: the host is not left holding what the attempt created.
    assert adapters.log.count("docker.remove") == len(fakes.TEARDOWN_KINDS) - 1
    assert adapters.log.count("credential.remove") == 1
    assert result.teardown_complete is True
    assert result.residuals == ()
    # The escalation names the unusable clock rather than reporting a clean envelope.
    assert any("clock" in finding for finding in result.findings)


class OverflowingClock:
    """A clock that answers `answers` genuine readings, then an `int` with no float form.

    `_guarded_clock`'s shape check (`type(reading) not in (int, float) or not
    isfinite(reading)`) sits outside the `try` that only wraps the raw `monotonic()` call.
    `isfinite` itself raises `OverflowError` when handed a Python `int` too large to convert
    to a float, so this one reading shape passes the type half of the check and then blows
    up the finiteness half — escaping `_guarded_clock`, and therefore
    `run_topology_rehearsal`, as a bare `OverflowError` instead of becoming a finding.
    """

    def __init__(self, log, *, answers: int = 1, opening: float = 0.0) -> None:
        self._log = log
        self._answers = answers
        self._opening = opening
        self._readings = 0

    def monotonic(self) -> object:
        self._readings += 1
        if self._readings <= self._answers:
            self._log.record("clock.monotonic", value=self._opening)
            return self._opening
        value = 10**400
        self._log.record("clock.monotonic", value=value)
        return value


def test_a_clock_reading_too_large_for_isfinite_before_consumption_refuses_without_mutating(
    runner,
) -> None:
    """An opening reading `isfinite` cannot even evaluate must refuse, not escape.

    The opening reading fixes the one envelope, so its failure must refuse before anything
    is consumed, exactly like every other unusable opening reading. An `OverflowError`
    escaping out of `_guarded_clock` instead of being caught the way every other seam here
    is caught defeats that guarantee entirely.
    """
    base = fakes.passing_adapters()
    adapters = dataclasses.replace(base, clock=OverflowingClock(base.log, answers=0))

    result = run(runner, adapters)

    assert result.outcome == fakes.PRECHECK_ABORT
    assert result.attempt_consumed is False
    assert adapters.log.count("ledger.consume") == 0
    for name in CREATE_CALLS:
        assert adapters.log.count(name) == 0
    assert adapters.log.count("docker.remove") == 0
    assert adapters.log.count("credential.remove") == 0
    assert result.teardown_complete is False
    assert result.residuals == ()
    assert any("clock" in finding for finding in result.findings)


def test_a_clock_reading_too_large_for_isfinite_after_creation_still_tears_the_attempt_down(
    runner,
) -> None:
    """A completion reading `isfinite` cannot evaluate may not strand a consumed attempt.

    The completion reading only records where the attempt ended, so an unusable reading
    must become a finding rather than an escape that leaves the network, volume, credential
    and container on the host with the ledger already consumed.
    """
    base = fakes.passing_adapters()
    adapters = dataclasses.replace(base, clock=OverflowingClock(base.log))

    result = run(runner, adapters)

    assert result.attempt_consumed is True
    assert result.outcome == fakes.STOP_CONTROL
    assert adapters.log.count("docker.remove") == len(fakes.TEARDOWN_KINDS) - 1
    assert adapters.log.count("credential.remove") == 1
    assert result.teardown_complete is True
    assert result.residuals == ()
    assert any("clock" in finding for finding in result.findings)


def test_a_completion_reading_earlier_than_the_opening_reading_is_a_stop_control_not_a_pass(
    runner,
) -> None:
    """A completion reading earlier than the opening reading is not an elapsed time at all.

    `elif completed > deadline` only ever escalates a completion reading that arrived too
    late. A completion reading that is *earlier* than the opening reading cannot be a real
    elapsed-time measurement either, yet the runner has no branch that catches it, so it
    reaches a falsely clean `TOPOLOGY_PASS` untouched.
    """
    adapters = fakes.passing_adapters(ticks=(10.0, 5.0))

    result = run(runner, adapters)

    assert result.outcome == fakes.STOP_CONTROL
    assert result.attempt_consumed is True
    assert result.teardown_complete is True
    assert result.evidence["timings"]["started"] == 10.0
    assert result.evidence["timings"]["completed"] == 5.0
    assert any(
        "completed" in finding or "clock" in finding or "envelope" in finding
        for finding in result.findings
    )


class DockerFailingOnRemove(fakes.FakeDocker):
    """A Docker port whose `remove` raises for exactly one teardown kind."""

    def __init__(self, log, *, failing_kind: str, **kwargs) -> None:
        super().__init__(log, **kwargs)
        self._failing_kind = failing_kind

    def remove(self, *, kind: str, name: str) -> None:
        super().remove(kind=kind, name=name)
        if kind == self._failing_kind:
            raise RuntimeError("synthetic removal failure")


class CredentialFailingOnRemove(fakes.FakeCredential):
    """A credential port whose `remove` raises instead of deleting the secret material."""

    def remove(self, *, name: str) -> None:
        super().remove(name=name)
        raise RuntimeError("synthetic removal failure")


def _teardown_adapters_failing_at(failing_kind: str) -> fakes.FakeAdapters:
    """Passing adapters with exactly one teardown kind's removal wired to raise."""
    base = fakes.passing_adapters()
    if failing_kind == fakes.TEARDOWN_KINDS[-1]:
        return dataclasses.replace(base, credential=CredentialFailingOnRemove(base.log))
    return dataclasses.replace(
        base, docker=DockerFailingOnRemove(base.log, failing_kind=failing_kind)
    )


@pytest.mark.parametrize("failing_kind", fakes.TEARDOWN_KINDS)
def test_a_failing_removal_of_one_kind_still_attempts_every_remaining_teardown_kind(
    runner, failing_kind
) -> None:
    """Teardown must isolate each removal so one raise cannot abandon the kinds after it.

    `_teardown` wraps the whole removal sequence — the three Docker kinds and the
    credential — in one `try`. A raise from removing any one kind today skips every kind
    that would have come after it in that single `try`; for a Docker kind that means the
    credential is never removed at all, and the credential is on-disk secret material
    (mode 0600), so an unremoved credential orphans secret material on the host. A finding
    naming the failed kind must also survive, not just a generic exception string.
    """
    adapters = _teardown_adapters_failing_at(failing_kind)

    result = run(runner, adapters)

    assert result.outcome == fakes.STOP_CONTROL
    assert result.attempt_consumed is True
    assert result.teardown_complete is False
    removed_kinds = tuple(item["kind"] for item in adapters.log.calls("docker.remove"))
    assert removed_kinds == fakes.TEARDOWN_KINDS[:-1]
    assert adapters.log.count("credential.remove") == 1
    assert any(failing_kind in finding for finding in result.findings)


class DockerFailingOnObserveResidual(fakes.FakeDocker):
    """A Docker port whose post-teardown residual read raises instead of answering."""

    def observe_residual(self):
        self._log.record("docker.observe_residual")
        raise RuntimeError("synthetic residual observation failure")


class CredentialFailingOnObserveResidual(fakes.FakeCredential):
    """A credential port whose post-teardown residual read raises instead of answering."""

    def observe_residual(self, *, name: str):
        self._log.record("credential.observe_residual", name=name)
        raise RuntimeError("synthetic residual observation failure")


class HostFailingOnFinalListenerObservation(fakes.FakeHost):
    """A host port whose *teardown* listener re-check raises; earlier reads still answer.

    `observe_listeners` is read three times in one clean attempt: once during read-only
    preparation, once during post-creation observation, and once again after teardown to
    prove the reviewed port was actually released. Only that third, post-teardown reading
    is the one this fake fails; the first two are answered exactly as `FakeHost` would.
    """

    def __init__(self, log, *, fail_at_call: int, **kwargs) -> None:
        super().__init__(log, **kwargs)
        self._fail_at_call = fail_at_call
        self._calls = 0

    def observe_listeners(self, *, port: int):
        self._calls += 1
        if self._calls == self._fail_at_call:
            self._log.record("host.observe_listeners", port=port)
            raise RuntimeError("synthetic listener observation failure")
        return super().observe_listeners(port=port)


POST_TEARDOWN_OBSERVATION_FACTORIES = (
    pytest.param(
        lambda base: dataclasses.replace(
            base, docker=DockerFailingOnObserveResidual(base.log)
        ),
        id="docker-observe-residual",
    ),
    pytest.param(
        lambda base: dataclasses.replace(
            base, credential=CredentialFailingOnObserveResidual(base.log)
        ),
        id="credential-observe-residual",
    ),
    pytest.param(
        lambda base: dataclasses.replace(
            base, host=HostFailingOnFinalListenerObservation(base.log, fail_at_call=3)
        ),
        id="host-final-observe-listeners",
    ),
)


@pytest.mark.parametrize("adapters_factory", POST_TEARDOWN_OBSERVATION_FACTORIES)
def test_a_raising_post_teardown_observation_still_returns_a_stop_control_result(
    runner, adapters_factory
) -> None:
    """Each post-teardown observation is a finding, never an exception that burns the attempt.

    `docker.observe_residual()`, `credential.observe_residual(...)` and the teardown
    re-check of `host.observe_listeners(...)` are each unguarded. If any of them raises,
    the exception escapes the whole function after the single-use ledger entry has already
    been consumed, burning the attempt with no `RehearsalResult` and no evidence at all.
    """
    base = fakes.passing_adapters()
    adapters = adapters_factory(base)

    result = run(runner, adapters)

    assert result.attempt_consumed is True
    assert result.outcome == fakes.STOP_CONTROL
    assert tuple(item["kind"] for item in adapters.log.calls("docker.remove")) == (
        "container",
        "network",
        "volume",
    )
    assert adapters.log.count("credential.remove") == 1
    assert result.teardown_complete is False
    assert any("teardown" in finding for finding in result.findings)


def test_the_runner_source_neither_reads_the_grant_nor_pins_a_fixture_digest() -> None:
    source = require_c8_path(SRC / PACKAGE / "runner.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    read_attributes = {
        node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)
    }
    assert "grant" not in read_attributes
    # `PreparationResult.selected_image_identity` is copied straight out of the grant, so
    # reading it here would launder a granted fact back into the facts that verify the
    # grant — self-witnessing that no `.grant` read and no "grant" literal would reveal.
    # The runner assembles this fact from the host projection plus the reviewed policy,
    # and therefore never reads the attribute at all.
    assert "selected_image_identity" not in read_attributes
    string_literals = {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }
    assert "grant" not in string_literals
    assert not re.search(r"\b[0-9a-f]{64}\b", source)


def reviewed_plan():
    """The one command plan the composition root is able to build.

    This is the identical construction `tests/test_scripts_inert.py` pins the wiring against,
    and the attempt id is not a free choice: `build_runtime_wiring(*, authorization,
    repository_roots)` is handed no host observation at all, and the instant that produces
    `fakes.SYNTHETIC_ATTEMPT_ID` exists in the whole envelope only as the grant's
    `observed_image_identity.observed_at`. A plan built before the host is read can therefore
    only ever carry the grant's pinned instant.
    """
    plan = load_c8("plan")
    return require_c8_attr(plan, "build_plan")(
        attempt_id=fakes.SYNTHETIC_ATTEMPT_ID,
        image_reference=f"postgres@{fakes.SYNTHETIC_MANIFEST_DIGEST}",
        repository_roots=fakes.SYNTHETIC_REPOSITORY_ROOTS,
    )


class PlanBoundDocker(fakes.FakeDocker):
    """A Docker port that refuses a name the reviewed plan does not carry.

    `fakes.FakeDocker` records whatever name it is handed, so every runner test above states
    what the runner *asks* for and nothing states whether the shipped port would accept it.
    The shipped `DockerCommandAdapter` does not record: it calls `protocols.require_exact`
    against `self._plan` before each create, each start and each removal, so a name that is
    not the plan's raises `ValueError` instead of reaching the daemon. That refusal is the
    reviewed behaviour rather than a fixture invention, so it is reproduced here through the
    real `require_exact` and a real `build_plan` result rather than a hand-written compare.
    """

    def __init__(self, log, *, plan, require_exact, **kwargs) -> None:
        super().__init__(log, **kwargs)
        self._plan = plan
        self._require_exact = require_exact

    def create_network(self, *, name: str, internal: bool) -> str:
        self._require_exact("name", name, self._plan.network_name)
        return super().create_network(name=name, internal=internal)

    def create_volume(self, *, name: str) -> str:
        self._require_exact("name", name, self._plan.volume_name)
        return super().create_volume(name=name)

    def create_container(self, *, name: str, network: str, volume: str, **kwargs) -> str:
        self._require_exact("name", name, self._plan.container_name)
        self._require_exact("network", network, self._plan.network_name)
        self._require_exact("volume", volume, self._plan.volume_name)
        return super().create_container(
            name=name, network=network, volume=volume, **kwargs
        )

    def start_container(self, *, name: str) -> None:
        self._require_exact("name", name, self._plan.container_name)
        super().start_container(name=name)

    def remove(self, *, kind: str, name: str) -> None:
        expected = {
            "container": self._plan.container_name,
            "network": self._plan.network_name,
            "volume": self._plan.volume_name,
        }
        self._require_exact("name", name, expected[kind])
        super().remove(kind=kind, name=name)


class PlanBoundCredential(fakes.FakeCredential):
    """A credential port that refuses a name the reviewed plan does not carry.

    The shipped `FileCredentialAdapter` reads the credential path off the plan for the one
    reviewed credential name only, so a name derived from a different instant cannot name a
    file the reviewed argv mounts. The credential is the on-disk secret material, so a
    refusal here is also what would leave it behind.
    """

    def __init__(self, log, *, plan, require_exact, **kwargs) -> None:
        super().__init__(log, **kwargs)
        self._plan = plan
        self._require_exact = require_exact

    def create(self, *, name: str) -> str:
        self._require_exact("name", name, self._plan.credential_name)
        return super().create(name=name)

    def remove(self, *, name: str) -> None:
        self._require_exact("name", name, self._plan.credential_name)
        super().remove(name=name)


def plan_bound_adapters(observed_at: str):
    """Passing adapters whose mutating ports are bound to the one composition-time plan."""
    plan = reviewed_plan()
    require_exact = require_c8_attr(load_c8("protocols"), "require_exact")
    base = fakes.passing_adapters(image=fakes.host_image(observed_at=observed_at))
    adapters = dataclasses.replace(
        base,
        docker=PlanBoundDocker(base.log, plan=plan, require_exact=require_exact),
        credential=PlanBoundCredential(base.log, plan=plan, require_exact=require_exact),
    )
    return adapters, plan


# Two host observations strictly later than the grant's pinned instant, both admitted by
# preparation (`observed_at` at or after the pin) and by the window (the runtime observation
# must not pass the loader's `now`, which is `00:01:00Z`). One second is the smallest gap a
# real host can produce; fifty-nine seconds is the largest this authorization admits, so the
# pair states the property across the whole admitted band rather than at one instant.
LATER_HOST_OBSERVATIONS = (
    pytest.param("2026-08-05T00:00:01Z", id="one-second-later"),
    pytest.param("2026-08-05T00:00:59Z", id="fifty-nine-seconds-later"),
)


@pytest.mark.parametrize("observed_at", LATER_HOST_OBSERVATIONS)
def test_a_host_observed_after_the_grant_pin_still_creates_names_the_plan_accepts(
    runner, observed_at
) -> None:
    """The attempt must be runnable on a host read later than the grant was signed.

    `_attempt_names` derives the attempt id from the *live* `prepared.image["observed_at"]`,
    which preparation admits at or after the grant pin rather than only at it. The plan those
    names are checked against is built by the composition root, which is handed the
    authorization and the control roots and nothing else, so it can only carry the grant's
    pinned instant. The two therefore agree on exactly one host in the world: the one that
    reports the same second the grant was signed on.

    Every existing runner test is green only because `fakes.IMAGE_OBSERVED_AT` is that exact
    instant, so the whole suite states the lifecycle at the single reading where the defect is
    invisible. On any real host — one second later is enough — the first create is refused,
    the attempt returns `"creation: raised ValueError: ..."` and the reviewed rehearsal fails
    closed on every execution it will ever have. Failing closed is not the same as working:
    the one authorized attempt would be spent proving that the names disagree.

    The property owed is agreement, not a particular repair. A repair that keeps one
    composition-time plan must make the attempt identity nameable before the host is read; a
    repair that completes the plan after the observation must expose the seam that completes
    it, and this fixture must then build its plan through that seam. Either way the created
    names and the enforced names are the same names for every observation the authorization
    admits, which is what this test states and what nothing states today.
    """
    # Arrange. The case is only meaningful while the observation is genuinely later than the
    # pin the plan was built from; an equal reading is the control below, not this test.
    assert observed_at > fakes.IMAGE_OBSERVED_AT
    adapters, plan = plan_bound_adapters(observed_at)
    assert plan.attempt_id == fakes.SYNTHETIC_ATTEMPT_ID

    # Act.
    result = run(runner, adapters)

    # Assert. The attempt runs to a real terminal verdict rather than being refused by its
    # own adapters, and every name it created is a name the reviewed plan carries.
    assert result.outcome == fakes.TOPOLOGY_PASS, result.findings
    assert not any("creation" in finding for finding in result.findings)
    assert adapters.log.calls("docker.create_network")[0]["name"] == plan.network_name
    assert adapters.log.calls("docker.create_volume")[0]["name"] == plan.volume_name
    assert adapters.log.calls("credential.create")[0]["name"] == plan.credential_name
    assert adapters.log.calls("docker.create_container")[0]["name"] == plan.container_name
    assert adapters.log.calls("docker.start_container")[0]["name"] == plan.container_name
    # Teardown reached every kind, so nothing the attempt created outlives it.
    assert tuple(item["kind"] for item in adapters.log.calls("docker.remove")) == (
        "container",
        "network",
        "volume",
    )
    assert adapters.log.count("credential.remove") == 1
    assert result.teardown_complete is True


def test_the_plan_bound_ports_pass_at_the_one_instant_the_grant_pinned(runner) -> None:
    """Anti-vacuity: the plan-bound ports refuse drift, not the fixture they are wired into.

    Without this control the test above could not distinguish "the attempt id does not track
    the plan" from "the plan-bound ports refuse everything", and a fixture that refused every
    name would look exactly like the defect it is meant to expose. Running the identical
    construction at `fakes.IMAGE_OBSERVED_AT` — the instant the grant pinned, and the only one
    at which the two agree today — must reach the same clean `TOPOLOGY_PASS` the unbound
    adapters reach, which is what makes the failure above a statement about the observation.
    """
    # Arrange.
    adapters, plan = plan_bound_adapters(fakes.IMAGE_OBSERVED_AT)

    # Act.
    result = run(runner, adapters)

    # Assert.
    assert result.outcome == fakes.TOPOLOGY_PASS
    assert result.attempt_consumed is True
    assert result.teardown_complete is True
    assert adapters.log.calls("docker.create_network")[0]["name"] == plan.network_name
    assert adapters.log.calls("docker.create_container")[0]["name"] == plan.container_name


# The attempt identity has exactly one renderer. Every one of the tests below states some
# part of that single property, because the defect it closes is not a wrong id: it is two
# independent renderings of one id, which drift silently and are discovered only by spending
# the single authorized attempt on a name the enforcing ports refuse.

# The exact strings HEAD renders for these instants, transcribed from the runner as it stands
# before this seam exists. They are the byte-identity control: exporting the formula may not
# change one character of the identity any reviewed plan already carries.
RENDERED_ATTEMPT_IDS = (
    pytest.param(fakes.IMAGE_OBSERVED_AT, fakes.SYNTHETIC_ATTEMPT_ID, id="the-pinned-instant"),
    pytest.param("2026-08-05T00:00:59Z", "20260805T000059Z-c8", id="the-last-admitted-second"),
    pytest.param("1999-12-31T23:59:59Z", "19991231T235959Z-c8", id="a-two-digit-free-instant"),
    pytest.param("2026-12-05T00:00:01Z", "20261205T000001Z-c8", id="a-day-month-swap-guard"),
)

# Everything that is not an exact UTC instant of the reviewed shape. A seam that answered any
# of these would hand the composition root a name no signed document authorized, so each is a
# refusal rather than a best effort.
UNUSABLE_INSTANTS = (
    pytest.param("", id="empty"),
    pytest.param("not-an-instant", id="prose"),
    pytest.param("2026-08-05T00:00:00+00:00", id="offset-instead-of-z"),
    pytest.param("2026-13-05T00:00:00Z", id="impossible-month"),
    pytest.param("2026-08-05 00:00:00Z", id="space-instead-of-t"),
    pytest.param("2026-8-5T00:00:00Z", id="unpadded-fields"),
    pytest.param("20260805T000000Z", id="already-rendered"),
    pytest.param(None, id="never-observed"),
    pytest.param(20260805000000, id="not-a-string"),
)

# Names that would mean the seam consulted something other than its argument. A renderer that
# reads a clock, an environment or a preparation snapshot is not a function of the pinned
# instant, and two callers of it would agree only by luck.
FORBIDDEN_SEAM_READS = frozenset(
    {
        "clock",
        "datetime",
        "environ",
        "getenv",
        "granted_observed_at",
        "monotonic",
        "now",
        "prepare",
        "prepared",
        "PreparationResult",
        "time",
        "today",
        "utcnow",
    }
)


def runner_tree() -> ast.Module:
    return ast.parse(require_c8_path(SRC / PACKAGE / "runner.py").read_text(encoding="utf-8"))


def runner_function(name: str) -> ast.FunctionDef:
    """The one module-level function of this name, or a RED failure naming its absence."""
    defined = [
        node
        for node in runner_tree().body
        if isinstance(node, ast.FunctionDef) and node.name == name
    ]
    if len(defined) != 1:
        pytest.fail(
            f"runner.py must define exactly one module-level {name}, found {len(defined)}",
            pytrace=False,
        )
    return defined[0]


def names_read_in(node: ast.AST) -> set[str]:
    """Every bare name and attribute name reached anywhere inside one node."""
    read: set[str] = set()
    for child in ast.walk(node):
        if isinstance(child, ast.Name):
            read.add(child.id)
        elif isinstance(child, ast.Attribute):
            read.add(child.attr)
    return read


def functions_reading(name: str) -> set[str]:
    """Every module-level function of runner.py whose body reaches for one name."""
    return {
        node.name
        for node in runner_tree().body
        if isinstance(node, ast.FunctionDef) and name in names_read_in(node)
    }


@pytest.mark.parametrize(("pinned", "expected"), RENDERED_ATTEMPT_IDS)
def test_the_attempt_identity_seam_renders_exactly_the_id_the_runner_already_creates(
    runner, pinned, expected
) -> None:
    """Exporting the formula is a move, not an edit: the identity is byte-identical.

    The reviewed plan, the resource names, the argv the operator reads and the enforcing
    ports all carry this string. A seam that rendered it differently would not be a repair of
    the drift risk; it would be the drift, landed deliberately.
    """
    assert require_c8_attr(runner, "attempt_id_for")(pinned) == expected


def test_the_attempt_identity_seam_is_the_one_the_composition_root_can_reach(runner) -> None:
    """The wiring holds a pinned instant and nothing else, so that must be the whole input.

    `build_runtime_wiring(*, authorization, repository_roots)` is handed no host observation,
    no preparation snapshot and no adapters. A seam it cannot call with what it holds is not
    a seam, and the wiring would be back to re-implementing the format against the same field.
    """
    seam = require_c8_attr(runner, "attempt_id_for")
    signature = inspect.signature(seam)
    parameters = list(signature.parameters.values())
    assert [parameter.name for parameter in parameters] == ["pinned_observed_at"]
    assert parameters[0].default is inspect.Parameter.empty
    assert parameters[0].kind in (
        inspect.Parameter.POSITIONAL_ONLY,
        inspect.Parameter.POSITIONAL_OR_KEYWORD,
    )
    assert isinstance(seam(fakes.IMAGE_OBSERVED_AT), str)


def test_the_attempt_identity_seam_is_a_pure_function_of_the_instant_it_is_handed(
    runner,
) -> None:
    """Same instant, same id; different instant, different id; nothing else consulted.

    Two callers agree by construction only if the renderer has no second input. A seam that
    read a clock, the host or the authorization would produce agreement that depends on when
    and where each caller ran, which is the convention this repair exists to remove.
    """
    # Arrange.
    seam = require_c8_attr(runner, "attempt_id_for")
    instants = [pinned for pinned, _ in (case.values for case in RENDERED_ATTEMPT_IDS)]

    # Act.
    first = [seam(pinned) for pinned in instants]
    second = [seam(pinned) for pinned in reversed(instants)]

    # Assert. Determinism, injectivity, and a body that reaches for nothing but its argument.
    assert first == list(reversed(second))
    assert len(set(first)) == len(first)
    assert names_read_in(runner_function("attempt_id_for")) & FORBIDDEN_SEAM_READS == set()


@pytest.mark.parametrize("pinned", UNUSABLE_INSTANTS)
def test_the_attempt_identity_seam_fails_closed_on_anything_but_an_exact_instant(
    runner, pinned
) -> None:
    """An unreadable pin names no attempt at all, and never a salvaged one."""
    abort = require_c8_attr(load_c8("errors"), "PrecheckAbort")
    with pytest.raises(abort) as raised:
        require_c8_attr(runner, "attempt_id_for")(pinned)
    assert repr(pinned) in str(raised.value)


def test_every_created_name_is_derived_from_the_one_exported_attempt_identity_seam(
    runner, monkeypatch
) -> None:
    """`_attempt_names` must call the seam, not re-render the same format beside it.

    Exporting a second renderer that agrees with the private one today would leave two
    formulas where there is one identity — exactly the shape that has to drift before anyone
    notices. Replacing the exported seam therefore has to move every name the attempt creates;
    if any of them still carries the format-rendered id, the private copy is still there.
    """
    # Arrange. A sentinel no format could render, so an unmoved name is unmistakable.
    sentinel = "seam-sentinel"
    monkeypatch.setattr(runner, "attempt_id_for", lambda pinned_observed_at: sentinel)
    adapters = fakes.passing_adapters()

    # Act.
    run(runner, adapters)

    # Assert. Every mutating create was named through the seam.
    created = (
        adapters.log.calls("docker.create_network")[0]["name"],
        adapters.log.calls("docker.create_volume")[0]["name"],
        adapters.log.calls("credential.create")[0]["name"],
        adapters.log.calls("docker.create_container")[0]["name"],
        adapters.log.calls("docker.start_container")[0]["name"],
    )
    assert created == (
        f"cybrik-topology-net-{sentinel}",
        f"cybrik-topology-vol-{sentinel}",
        f"cybrik-topology-credential-{sentinel}",
        f"cybrik-topology-{sentinel}",
        f"cybrik-topology-{sentinel}",
    )
    assert not any(fakes.SYNTHETIC_ATTEMPT_ID in name for name in created)


def test_the_attempt_identity_format_is_rendered_in_exactly_one_place(runner) -> None:
    """One identity, one renderer, and the private namer is a caller of it like any other.

    This is the structural half of the property: the behavioural test above can only see the
    names the runner creates, so a second rendering sited anywhere the attempt does not reach
    would still satisfy it. The format and its slice label are reachable from exactly one
    function, and `_attempt_names` reaches the identity only by calling that function.
    """
    assert functions_reading("strftime") == {"attempt_id_for"}
    assert functions_reading("ATTEMPT_INSTANT_FORMAT") == {"attempt_id_for"}
    assert functions_reading("ATTEMPT_SLICE") == {"attempt_id_for"}
    namer = runner_function("_attempt_names")
    called = {
        node.func.id
        for node in ast.walk(namer)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    assert "attempt_id_for" in called


def test_created_names_carry_the_granted_pin_not_this_host_s_live_observation(
    runner,
) -> None:
    """The seam is fed the instant the authorization pinned, never the one this host read.

    The two tests above can only see *that* every name routes through the one renderer; they
    cannot see *which* instant is handed to it, because in the default fixtures the grant pin
    and the live host reading are the same string. That equality is the whole hazard: the
    drift `_attempt_names` exists to prevent is invisible until a host answers with a later
    observation, and by then the single authorized attempt has been spent creating names its
    own plan-bound ports refuse. So this drives a host that reports a *different* admitted
    observation — later than the pin, which preparation accepts — and pins the created names
    to the pin's identity. Feeding the live reading to the seam instead moves every one of
    them, which is exactly the regression that must not be silent.
    """
    # Arrange. An admitted host reading strictly after the grant pin, so the two instants
    # render two different identities and only one of them can be the created names'.
    live_observed_at = "2026-08-05T00:01:00Z"
    live_attempt_id = "20260805T000100Z-c8"
    assert live_observed_at != fakes.IMAGE_OBSERVED_AT
    assert live_attempt_id != fakes.SYNTHETIC_ATTEMPT_ID
    adapters = fakes.passing_adapters(
        image=fakes.host_image(observed_at=live_observed_at)
    )

    # Act.
    result = run(runner, adapters)

    # Assert. Every created name is the pin's identity; none carries the live reading's.
    created = tuple(adapters.log.calls(call)[0]["name"] for call in CREATE_CALLS)
    assert result.outcome == fakes.TOPOLOGY_PASS
    assert created == (
        fakes.NETWORK_NAME,
        fakes.VOLUME_NAME,
        fakes.CREDENTIAL_NAME,
        fakes.CONTAINER_NAME,
        fakes.CONTAINER_NAME,
    )
    assert not any(live_attempt_id in name for name in created)
