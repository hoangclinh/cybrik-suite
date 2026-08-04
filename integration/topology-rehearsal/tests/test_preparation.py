"""Read-only preparation must prove every pre-consumption fact or abort cleanly."""

from __future__ import annotations

import pytest

import fakes
import documents
from conftest import load_c8, require_c8_attr


MUTATIONS = (
    "docker.create_network",
    "docker.create_volume",
    "docker.create_container",
    "docker.start_container",
    "ledger.consume",
)


@pytest.fixture(name="preparation")
def preparation_module():
    return load_c8("preparation")


def prepare(preparation, adapters=None, authorization=None):
    return require_c8_attr(preparation, "prepare")(
        authorization or documents.authorization(),
        adapters or fakes.passing_adapters(),
    )


def test_preparation_observes_controls_host_platform_image_port_and_probe(preparation) -> None:
    adapters = fakes.passing_adapters()
    result = prepare(preparation, adapters)
    assert result.satisfied is True
    names = adapters.log.names()
    for expected in (
        "identities.observe_controls",
        "host.observe_image",
        "host.observe_ephemeral_range",
        "host.observe_listeners",
        "docker.observe_platform",
        "docker.observe_executable_digest",
        "docker.observe_publications",
        "probe.observe_digest",
    ):
        assert names.count(expected) == 1
    assert not set(names) & set(MUTATIONS)


@pytest.mark.parametrize(
    "adapters",
    [
        lambda: fakes.passing_adapters(identities=None),
        lambda: fakes.passing_adapters(
            identities={fakes.SUITE_CONTROL: {"commit": "0" * 40, "clean": True}}
        ),
        lambda: fakes.passing_adapters(image=None),
        lambda: fakes.passing_adapters(ephemeral_range=None),
        lambda: fakes.passing_adapters(ephemeral_range=(10000, 20000)),
        lambda: fakes.passing_adapters(listeners=((fakes.LOOPBACK_LISTENER,),)),
        lambda: fakes.passing_adapters(platform=None),
        lambda: fakes.passing_adapters(docker_digest=None),
        lambda: fakes.passing_adapters(docker_digest="0" * 64),
        lambda: fakes.passing_adapters(probe_digest=None),
        lambda: fakes.passing_adapters(probe_digest="0" * 64),
        lambda: fakes.passing_adapters(publications=("127.0.0.1:15433",)),
    ],
)
def test_any_unresolved_or_mismatched_precondition_aborts_before_consumption(
    preparation, adapters
) -> None:
    current = adapters()
    with pytest.raises(require_c8_attr(load_c8("errors"), "PrecheckAbort")):
        prepare(preparation, current)
    assert not set(current.log.names()) & set(MUTATIONS)


@pytest.mark.parametrize(
    "patch",
    [
        # A dirty worktree, whichever control repository reports it.
        {fakes.SUITE_CONTROL: {"clean": False}},
        {fakes.FABRIC_CONTROL: {"clean": False}},
        # An unresolved cleanliness observation is not a clean worktree.
        {fakes.SOC_CONTROL: {"clean": None}},
        # A tree that drifts from the reviewed content, on the reviewed commit.
        {fakes.AI_CONTROL: {"tree": "0" * 40}},
        {fakes.SUITE_CONTROL: {"tree": fakes.SYNTHETIC_SOC_TREE}},
        # A control identity that reports no tree at all cannot witness content.
        {fakes.SOC_CONTROL: {"tree": None}},
    ],
)
def test_control_worktree_drift_or_uncleanliness_aborts_before_consumption(
    preparation, patch
) -> None:
    """The git tree and status outputs must both change the verdict, never be ignored."""
    current = fakes.passing_adapters(identities=fakes.control_identities(patch))
    with pytest.raises(require_c8_attr(load_c8("errors"), "PrecheckAbort")):
        prepare(preparation, current)
    assert not set(current.log.names()) & set(MUTATIONS)


def test_the_clean_control_fixture_reports_commit_tree_and_cleanliness(preparation) -> None:
    identities = fakes.control_identities()
    assert set(identities) == set(fakes.EXPECTED_CONTROLS)
    for name, identity in identities.items():
        assert set(identity) == {"commit", "tree", "clean"}
        assert identity["commit"] == fakes.EXPECTED_CONTROLS[name]
        assert identity["tree"] == fakes.EXPECTED_TREES[name]
        assert identity["clean"] is True
    assert prepare(preparation, fakes.passing_adapters(identities=identities)).satisfied


@pytest.mark.parametrize(
    "image",
    [
        fakes.host_image(index_digest=fakes.SYNTHETIC_OTHER_INDEX_DIGEST),
        fakes.host_image(manifest_digest=fakes.SYNTHETIC_OTHER_MANIFEST_DIGEST),
        fakes.host_image(platform=dict(fakes.OTHER_IMAGE_PLATFORM)),
        fakes.host_image(index_digest=None),
        fakes.host_image(manifest_digest=None),
        fakes.host_image(platform=None),
        fakes.host_image(present=False),
        fakes.host_image(local_image_id=None),
    ],
)
def test_a_host_image_that_is_not_exactly_the_selected_identity_aborts(
    preparation, image
) -> None:
    current = fakes.passing_adapters(image=image)
    with pytest.raises(require_c8_attr(load_c8("errors"), "PrecheckAbort")):
        prepare(preparation, current)
    assert not set(current.log.names()) & set(MUTATIONS)


def test_unresolved_selected_image_identity_aborts_without_host_mutation(preparation) -> None:
    document = documents.with_nested(
        documents.grant_document(),
        "selected_image_identity",
        {"index_digest": None, "manifest_digest": None, "platform": None},
    )
    auth = documents.authorization(
        grant=document,
        grant_bytes=documents.canonical_bytes(document),
    )
    adapters = fakes.passing_adapters()
    with pytest.raises(require_c8_attr(load_c8("errors"), "PrecheckAbort")):
        prepare(preparation, adapters, auth)
    assert not set(adapters.log.names()) & set(MUTATIONS)


def test_preparation_never_consults_the_signature_verifier(preparation) -> None:
    adapters = fakes.passing_adapters()
    prepare(preparation, adapters)
    assert "verifier.verify" not in adapters.log.names()


def test_preparation_exports_only_the_read_only_phase(preparation) -> None:
    assert set(require_c8_attr(preparation, "__all__")) == {
        "PreparationResult",
        "prepare",
    }
