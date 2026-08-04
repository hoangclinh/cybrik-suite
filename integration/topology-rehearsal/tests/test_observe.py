"""Fail-closed reductions over the five publication views and internal network."""

from __future__ import annotations

import dataclasses

import pytest

import fakes
import documents
from conftest import load_c8, require_c8_attr


@pytest.fixture(name="observe")
def observe_module():
    return load_c8("observe")


@pytest.fixture(name="errors")
def errors_module():
    return load_c8("errors")


def call(observe, name: str, *args, **kwargs):
    return require_c8_attr(observe, name)(*args, **kwargs)


def publication_inputs(**overrides):
    """The four agreeing publication views, with any one of them replaced.

    The agreeing set is written once. A per-case copy would let the *passing* baseline drift
    between cases, so a control could pass because its baseline had quietly weakened rather
    than because the reduction refused the one view under test.
    """
    inputs = {
        "daemon_event": fakes.OBSERVED_PUBLICATION,
        "container": fakes.container_projection(),
        "docker_port": fakes.OBSERVED_PUBLICATION,
        "listeners": (fakes.LOOPBACK_LISTENER,),
    }
    inputs.update(overrides)
    return inputs


def port_binding(**overrides):
    """One `PortBindings` entry for the reviewed container port."""
    return {"HostIp": fakes.HOST_IP, "HostPort": str(fakes.HOST_PORT), **overrides}


def test_all_five_exact_publication_views_reduce_to_one_agreement(observe) -> None:
    verdict = call(
        observe,
        "validate_publication",
        daemon_event=fakes.OBSERVED_PUBLICATION,
        container=fakes.container_projection(),
        docker_port=fakes.OBSERVED_PUBLICATION,
        listeners=(fakes.LOOPBACK_LISTENER,),
    )
    assert verdict.satisfied is True
    assert verdict.findings == ()
    assert tuple(verdict.views) == fakes.PUBLICATION_VIEWS


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("daemon_event", "0.0.0.0:15433"),
        ("docker_port", ":::15433"),
        ("listeners", ()),
        ("listeners", (fakes.WILDCARD_LISTENER,)),
        ("listeners", (fakes.IPV6_LISTENER,)),
        ("container", fakes.container_projection(bindings={})),
        ("container", fakes.container_projection(ports={})),
    ],
)
def test_any_missing_ambiguous_or_wildcard_publication_view_fails_closed(
    observe, field: str, value
) -> None:
    verdict = call(observe, "validate_publication", **publication_inputs(**{field: value}))
    assert verdict.satisfied is False
    assert verdict.findings


def test_internal_network_requires_internal_true_and_exactly_one_attachment(observe) -> None:
    assert call(
        observe, "validate_internal_network", fakes.network_projection()
    ).satisfied is True
    for projection in (
        fakes.network_projection(internal=False),
        fakes.network_projection(containers={}),
        fakes.network_projection(containers={"a": {}, "b": {}}),
        None,
    ):
        assert call(observe, "validate_internal_network", projection).satisfied is False


def test_health_and_probe_must_both_be_exactly_positive(observe) -> None:
    assert call(observe, "validate_internal_ingress", "healthy", "reachable").satisfied
    for health, probe in ((None, "reachable"), ("starting", "reachable"), ("healthy", None), ("healthy", "refused")):
        assert not call(observe, "validate_internal_ingress", health, probe).satisfied


def test_image_observation_keeps_registry_and_local_identities_separate(observe) -> None:
    selected = documents.grant_document()["selected_image_identity"]
    observed = documents.grant_document()["observed_image_identity"]
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied
    assert observed["local_image_id"] not in {
        selected["index_digest"],
        selected["manifest_digest"],
    }


@pytest.mark.parametrize("key", ("index_digest", "manifest_digest", "platform"))
def test_an_unresolved_selected_identity_fails_closed(observe, key: str) -> None:
    selected = dict(documents.grant_document()["selected_image_identity"])
    observed = dict(documents.grant_document()["observed_image_identity"])
    selected[key] = None
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied is False
    assert "unresolved" in " ".join(verdict.findings).lower()


@pytest.mark.parametrize(
    ("key", "host_value"),
    (
        ("index_digest", fakes.SYNTHETIC_OTHER_INDEX_DIGEST),
        ("manifest_digest", fakes.SYNTHETIC_OTHER_MANIFEST_DIGEST),
        ("platform", dict(fakes.OTHER_IMAGE_PLATFORM)),
    ),
)
def test_a_resolved_host_image_disagreeing_with_the_selection_fails_closed(
    observe, key: str, host_value
) -> None:
    """Both sides resolved and different is a mismatch, not an unresolved value."""
    selected = dict(documents.grant_document()["selected_image_identity"])
    observed = dict(documents.grant_document()["observed_image_identity"])
    observed[key] = host_value
    assert selected[key] is not None and observed[key] is not None
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied is False
    assert any(key in finding for finding in verdict.findings)
    assert "unresolved" not in " ".join(verdict.findings).lower()


@pytest.mark.parametrize("key", ("index_digest", "manifest_digest", "platform"))
def test_an_unresolved_host_observation_is_never_read_as_agreement(
    observe, key: str
) -> None:
    selected = dict(documents.grant_document()["selected_image_identity"])
    observed = dict(documents.grant_document()["observed_image_identity"])
    observed[key] = None
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied is False
    assert verdict.findings


def test_a_differing_local_image_id_is_never_read_as_a_disagreement(observe) -> None:
    """The host's local image id is an observation, not a second opinion on the selection.

    A local id names bytes on one host and can never equal a registry digest, so comparing
    it against the selection would turn every correct observation into a mismatch. The
    stated separation is behavioural here, not a property of one fixture.
    """
    selected = documents.grant_document()["selected_image_identity"]
    observed = dict(documents.grant_document()["observed_image_identity"])
    observed["local_image_id"] = fakes.D2_OBSERVED_IMAGE_ID
    verdict = call(observe, "validate_image_identity", selected, observed)
    assert verdict.satisfied is True
    assert verdict.findings == ()


def test_the_selection_only_pull_policy_is_never_demanded_of_a_host_observation(
    observe,
) -> None:
    """`pull_policy` is a rule for the attempt, not something a host can report."""
    selected = documents.grant_document()["selected_image_identity"]
    observed = documents.grant_document()["observed_image_identity"]
    assert "pull_policy" in selected and "pull_policy" not in observed
    assert call(observe, "validate_image_identity", selected, observed).satisfied is True


def test_every_publication_verdict_reports_all_five_views_read_only(observe) -> None:
    """A refusal must still say what each of the five views actually showed.

    A verdict that dropped its views on failure would leave a reader with a refusal and no
    way to see which projection disagreed, which is the whole reason the five are compared.
    """
    verdict = call(
        observe,
        "validate_publication",
        **publication_inputs(
            daemon_event=None, container=None, docker_port=None, listeners=()
        ),
    )
    assert verdict.satisfied is False
    assert tuple(verdict.views) == fakes.PUBLICATION_VIEWS
    assert all(observed is None for observed in verdict.views.values())
    with pytest.raises(TypeError):
        verdict.views["daemon_event"] = fakes.OBSERVED_PUBLICATION


def test_each_publication_finding_names_the_exact_view_that_refused(observe) -> None:
    verdict = call(observe, "validate_publication", **publication_inputs(listeners=()))
    assert verdict.findings
    assert all(finding.startswith("host_listener") for finding in verdict.findings)


@pytest.mark.parametrize(
    "overrides",
    (
        {"listeners": (fakes.LOOPBACK_LISTENER, fakes.LOOPBACK_LISTENER)},
        {"container": fakes.container_projection(
            bindings={fakes.CONTAINER_PORT_KEY: [port_binding(), port_binding()]}
        )},
        {"container": fakes.container_projection(
            ports={fakes.CONTAINER_PORT_KEY: [port_binding(), port_binding()]}
        )},
    ),
)
def test_a_second_listener_or_binding_is_ambiguous_and_fails_closed(
    observe, overrides
) -> None:
    """Two claims for one reviewed port is an ambiguity, not a doubled agreement."""
    verdict = call(observe, "validate_publication", **publication_inputs(**overrides))
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize(
    "listener",
    (
        {"address": fakes.HOST_IP, "port": fakes.HOST_PORT + 1, "protocol": fakes.PORT_PROTOCOL},
        {"address": fakes.HOST_IP, "port": fakes.HOST_PORT, "protocol": "udp"},
        {"address": fakes.HOST_IP, "port": str(fakes.HOST_PORT), "protocol": fakes.PORT_PROTOCOL},
        {"address": fakes.HOST_IP, "port": True, "protocol": fakes.PORT_PROTOCOL},
        {"address": "", "port": fakes.HOST_PORT, "protocol": fakes.PORT_PROTOCOL},
        {"port": fakes.HOST_PORT, "protocol": fakes.PORT_PROTOCOL},
        fakes.HOST_IP,
    ),
)
def test_a_listener_that_is_not_the_reviewed_binding_fails_closed(
    observe, listener
) -> None:
    """A near-miss listener is not the reviewed publication.

    `port=True` is stated deliberately: `bool` is an `int` in Python, so a flag handed back
    instead of a port would compare equal to `1` and could be read as a real reading.
    """
    verdict = call(observe, "validate_publication", **publication_inputs(listeners=(listener,)))
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize(
    "container",
    (
        None,
        "",
        (),
        {"HostConfig": None, "NetworkSettings": None},
        fakes.container_projection(bindings={fakes.CONTAINER_PORT_KEY: ()}),
        fakes.container_projection(bindings={fakes.CONTAINER_PORT_KEY: [{}]}),
        fakes.container_projection(
            bindings={fakes.CONTAINER_PORT_KEY: [port_binding(HostPort=fakes.HOST_PORT)]}
        ),
        fakes.container_projection(
            bindings={fakes.CONTAINER_PORT_KEY: [port_binding(HostIp=None)]}
        ),
        fakes.container_projection(bindings={fakes.CONTAINER_PORT_KEY: port_binding()}),
    ),
)
def test_a_malformed_container_projection_fails_closed_rather_than_raising(
    observe, container
) -> None:
    """A projection is injected, so its shape is never guaranteed and never assumed."""
    verdict = call(observe, "validate_publication", **publication_inputs(container=container))
    assert verdict.satisfied is False
    assert verdict.findings


@pytest.mark.parametrize(
    "projection",
    (
        fakes.network_projection(internal=1),
        fakes.network_projection(internal="true"),
        fakes.network_projection(containers=()),
        {"Internal": True},
        "",
        (),
    ),
)
def test_a_network_projection_that_is_not_exactly_the_reviewed_shape_fails_closed(
    observe, projection
) -> None:
    """`Internal` must be exactly `True`; a merely truthy flag is not an isolated network."""
    verdict = call(observe, "validate_internal_network", projection)
    assert verdict.satisfied is False
    assert verdict.findings


def test_every_refusal_carries_its_own_exact_terminal_class(observe, errors) -> None:
    """A reducer names the terminal class its refusal belongs to; no caller re-decides it."""
    error_for = require_c8_attr(errors, "error_for")
    refusals = (
        (
            call(
                observe,
                "validate_publication",
                **publication_inputs(
                    daemon_event=None, container=None, docker_port=None, listeners=()
                ),
            ),
            "PublicationFailure",
        ),
        (call(observe, "validate_internal_network", None), "InternalIngressFailure"),
        (call(observe, "validate_internal_ingress", None, None), "InternalIngressFailure"),
        (call(observe, "validate_image_identity", None, None), "PrecheckAbort"),
    )
    for verdict, expected in refusals:
        assert verdict.satisfied is False
        assert error_for(verdict.outcome) is require_c8_attr(errors, expected)


def test_a_satisfied_verdict_names_no_terminal_class(observe) -> None:
    verdict = call(observe, "validate_internal_ingress", "healthy", "reachable")
    assert verdict.satisfied is True
    assert verdict.outcome is None


@pytest.mark.parametrize(
    "fields",
    (
        {"satisfied": True, "findings": ("host_listener: refused",)},
        {"satisfied": True, "outcome": fakes.FAIL_PUBLICATION},
        {"satisfied": False},
        {"satisfied": False, "findings": ("host_listener: refused",)},
        {"satisfied": False, "outcome": fakes.FAIL_PUBLICATION},
        {"satisfied": False, "findings": ("",), "outcome": fakes.FAIL_PUBLICATION},
        {
            "satisfied": False,
            "findings": ("host_listener: refused",),
            "outcome": fakes.TOPOLOGY_PASS,
        },
        {
            "satisfied": False,
            "findings": ["host_listener: refused"],
            "outcome": fakes.FAIL_PUBLICATION,
        },
    ),
)
def test_an_incoherent_verdict_cannot_be_constructed(observe, fields) -> None:
    """A satisfied refusal, an unexplained one and a passing failure class are all refused.

    The consistency is enforced at construction rather than trusted, because a verdict is
    the evidence a later phase reads: one that said `satisfied` while carrying findings
    would let a refused observation be recorded as a satisfied control.
    """
    verdict_type = require_c8_attr(observe, "ObservationVerdict")
    with pytest.raises(ValueError):
        verdict_type(**fields)


def test_a_coherent_verdict_is_immutable(observe) -> None:
    verdict_type = require_c8_attr(observe, "ObservationVerdict")
    verdict = verdict_type(
        satisfied=False,
        findings=("host_listener: refused",),
        outcome=fakes.FAIL_PUBLICATION,
    )
    with pytest.raises(dataclasses.FrozenInstanceError):
        verdict.satisfied = True


def test_observation_module_exports_only_pure_reducers(observe) -> None:
    assert set(require_c8_attr(observe, "__all__")) == {
        "ObservationVerdict",
        "validate_image_identity",
        "validate_internal_ingress",
        "validate_internal_network",
        "validate_publication",
    }
