"""The complete one-attempt lifecycle, classification and teardown specification."""

from __future__ import annotations

import pytest

import fakes
import documents
from conftest import load_c8, require_c8_attr


CREATE_CALLS = (
    "docker.create_network",
    "docker.create_volume",
    "credential.create",
    "docker.create_container",
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


def test_creation_is_exactly_network_volume_credential_container_once(runner) -> None:
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
