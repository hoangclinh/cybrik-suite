"""The complete one-attempt lifecycle, classification and teardown specification."""

from __future__ import annotations

import ast
import dataclasses
import re

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


def test_runner_exports_only_the_result_and_single_entrypoint(runner) -> None:
    assert set(require_c8_attr(runner, "__all__")) == {
        "RehearsalResult",
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
