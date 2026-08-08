"""F131's owed executed RED: is the container ingress reading cross-checked, or only frozen?

F131 was filed P1 *derived from source, not proved by execution*, and the ledger records it as
**OWED an executed RED before any repair**. This module pays exactly that debt and nothing more.
It repairs nothing. It converts an allegation into a measurement.

The allegation, in the words of `runner._proved_reading`'s own docstring: `frozen` "rebuilds a
mapping from one `.items()` read and never consults its subscript". The network reading goes
through `_proved_reading`, which cross-checks the two views. The container reading at
`runner.py:434` is wrapped in bare `frozen`, so a two-faced container reading is copied on its
stored face, judged on that face, and recorded on that face, while the same live object read by
subscript publishes somewhere else.

Vacuity discipline: an earlier draft of this module built the two-faced reading on an invented
shape. The honest reading of that shape *also* failed, on shape validation rather than on
divergence, so the case proved nothing. Every case below is therefore built on the real
`fakes.container_projection()` and paired with an honest control that must reach a topology pass.
"""

from __future__ import annotations

import documents
import fakes
import pytest
from conftest import load_c8, require_c8_attr

# A binding the reviewed publication allows: the one loopback address.
BENIGN_BINDING = {
    fakes.CONTAINER_PORT_KEY: [
        {"HostIp": fakes.HOST_IP, "HostPort": str(fakes.HOST_PORT)}
    ]
}
# A binding the reviewed publication forbids: every interface on the host.
HOSTILE_BINDING = {
    fakes.CONTAINER_PORT_KEY: [{"HostIp": "0.0.0.0", "HostPort": str(fakes.HOST_PORT)}]
}


@pytest.fixture(name="runner")
def runner_module():
    return load_c8("runner")


@pytest.fixture(name="preparation")
def preparation_module():
    return load_c8("preparation")


def two_faced_bindings():
    """Port bindings that iterate benign and subscript hostile.

    A live `docker inspect` projection nests plain `dict`s, so the double must be one, exactly
    as `test_observe.subscripting_plainly` is.
    """

    class SubscriptsItsOwnAnswer(dict):
        def __getitem__(self, key: str):
            if key in HOSTILE_BINDING:
                return HOSTILE_BINDING[key]
            return super().__getitem__(key)

    return SubscriptsItsOwnAnswer(BENIGN_BINDING)


def run(runner, container):
    return require_c8_attr(runner, "run_topology_rehearsal")(
        documents.authorization(),
        fakes.passing_adapters(container=container),
        execute_requested=True,
    )


def test_the_double_is_genuinely_two_faced() -> None:
    """Premise. If both views agreed, every case below would be vacuous."""
    bindings = two_faced_bindings()
    assert dict(bindings.items())[fakes.CONTAINER_PORT_KEY][0]["HostIp"] == fakes.HOST_IP
    assert bindings[fakes.CONTAINER_PORT_KEY][0]["HostIp"] == "0.0.0.0"


def test_frozen_takes_only_the_items_face(preparation) -> None:
    """Positive control: the blind spot F131 names is real, at the `frozen` boundary."""
    copied = require_c8_attr(preparation, "frozen")(two_faced_bindings())
    assert copied[fakes.CONTAINER_PORT_KEY][0]["HostIp"] == fakes.HOST_IP, (
        "premise of F131: `frozen` copies the stored face and never consults the subscript"
    )


def test_proved_reading_refuses_the_same_reading(runner) -> None:
    """Positive control: the guard, where it is applied, closes that blind spot."""
    with pytest.raises(ValueError):
        require_c8_attr(runner, "_proved_reading")(two_faced_bindings(), "container")


def test_the_honest_container_reading_still_passes(runner) -> None:
    """Vacuity control. Without this, a refusal below could be mere shape rejection."""
    honest = fakes.container_projection(bindings=BENIGN_BINDING)
    assert run(runner, honest).outcome == fakes.TOPOLOGY_PASS


def test_the_container_ingress_reading_is_cross_checked(runner) -> None:
    """F131's claim, driven through the runner rather than read off the source.

    INTENDED RED while `runner.py:434` wraps the container reading in bare `frozen`. The two
    readings differ only in the subscript face, and the honest control above proves the shape
    reaches a pass, so a pass here is the bypass itself: the receipt attests the reviewed
    loopback publication while the same live object subscripts every interface on the host.

    This must turn GREEN only by putting the container reading through the divergence
    cross-check, never by weakening a publication control or relaxing this assertion.
    """
    two_faced = fakes.container_projection(bindings=two_faced_bindings())
    assert run(runner, two_faced).outcome != fakes.TOPOLOGY_PASS, (
        "a container reading whose two views disagree reached a topology pass: F131 is "
        "proved by execution, and the container ingress is unguarded"
    )
