"""Fail-closed reductions over the five publication views and internal network."""

from __future__ import annotations

import pytest

import fakes
import documents
from conftest import load_c8, require_c8_attr


@pytest.fixture(name="observe")
def observe_module():
    return load_c8("observe")


def call(observe, name: str, *args, **kwargs):
    return require_c8_attr(observe, name)(*args, **kwargs)


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
    inputs = {
        "daemon_event": fakes.OBSERVED_PUBLICATION,
        "container": fakes.container_projection(),
        "docker_port": fakes.OBSERVED_PUBLICATION,
        "listeners": (fakes.LOOPBACK_LISTENER,),
    }
    inputs[field] = value
    verdict = call(observe, "validate_publication", **inputs)
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


def test_observation_module_exports_only_pure_reducers(observe) -> None:
    assert set(require_c8_attr(observe, "__all__")) == {
        "ObservationVerdict",
        "validate_image_identity",
        "validate_internal_ingress",
        "validate_internal_network",
        "validate_publication",
    }
