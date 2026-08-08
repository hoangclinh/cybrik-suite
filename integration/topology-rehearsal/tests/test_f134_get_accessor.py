"""F134: `stored_entries` cross-checks `__getitem__`, but every validator judges through `.get`.

F134 was filed **P1 OPEN, PROVED-BY-EXECUTION** by cycle 58's independent reviewer. It is the
reviewer-designated *prerequisite* for F131:

> **Do not schedule F131's repair as "apply `_proved_reading` to two more call sites."**
> `views.proved_copy` must be fixed first, or the fix will measure GREEN while still bypassable.

This module re-establishes that finding as a live executable RED in-repo, so the repair has a
falsifiable target rather than a ledger quotation. The reviewer's own reproduction lived in a
`/tmp` scratch tree and did not survive into the repository.

The defect, exactly: `views.stored_entries` reads `mapping.items()` once and cross-checks
`mapping[key]`. It never consults `mapping.get(key)`. But `.get` is the accessor the package's
validators actually judge through — `observe`'s `projection.get("Internal")` and
`projection.get("Containers")` reads, and `views.nested`. So a reading
that is honest to `items()` and to `__getitem__`, and lies only to `.get`, clears every declared
cross-check while stating something else to every reader the cross-check exists to protect.

Anti-vacuity discipline, inherited from `test_f131_ingress_guard`: every case below is built on the
real `fakes.network_projection()` shape and paired with an honest control that must reach a
`TOPOLOGY_PASS`. Without that control a refusal below could be mere shape rejection and would
prove nothing.
"""

from __future__ import annotations

from types import MappingProxyType

import documents
import fakes
import pytest
from conftest import load_c8, require_c8_attr

INTERNAL_KEY = "Internal"


@pytest.fixture(name="views")
def views_module():
    return load_c8("views")


@pytest.fixture(name="observe")
def observe_module():
    return load_c8("observe")


@pytest.fixture(name="runner")
def runner_module():
    return load_c8("runner")


def get_liar():
    """A network reading honest to `items()` and to `__getitem__`, hostile only to `.get`.

    A real Docker network projection is a plain `dict`, so the double is one. `Internal: True`
    is the reviewed isolation; the `.get` face states `False`, which is a network with a route
    off the host — a live `STOP_CONTROL` by this package's own validator.
    """

    class LiesOnlyToGet(dict):
        def get(self, key, default=None):
            if key == INTERNAL_KEY:
                return False
            return super().get(key, default)

    return LiesOnlyToGet(fakes.network_projection(internal=True))


def run(runner, network):
    return require_c8_attr(runner, "run_topology_rehearsal")(
        documents.authorization(),
        fakes.passing_adapters(network=network),
        execute_requested=True,
    )


def test_the_double_lies_only_to_get() -> None:
    """Premise. If all three views agreed, every case below would be vacuous."""
    reading = get_liar()
    assert dict(reading.items())[INTERNAL_KEY] is True
    assert reading[INTERNAL_KEY] is True
    assert reading.get(INTERNAL_KEY) is False


def test_the_package_validator_refuses_the_live_reading(observe) -> None:
    """Positive control: the reading is genuinely hostile by the package's own standard.

    `validate_internal_network` judges through `.get`, so handed the live object it refuses it.
    Any pass reached below is therefore a bypass and not a difference of opinion.
    """
    verdict = require_c8_attr(observe, "validate_internal_network")(get_liar())
    assert verdict.satisfied is False


def test_the_honest_network_reading_still_passes(runner) -> None:
    """Vacuity control. Without this, a refusal below could be mere shape rejection."""
    assert run(runner, fakes.network_projection(internal=True)).outcome == fakes.TOPOLOGY_PASS


def test_proved_copy_cross_checks_the_get_accessor(views) -> None:
    """F134's claim at the unit boundary.

    GREEN since `stored_entries` cross-checks `.get`; it was the INTENDED RED of the commit that
    proved F134 and is now a regression control. The `.get` face contradicts the one `.items()`
    read this copy is built from, so the two views of one entry disagree and the reading must be
    refused rather than taken on its stored face.
    """
    _, _, divergence = require_c8_attr(views, "proved_copy")(
        MappingProxyType(get_liar()), "network"
    )
    assert divergence, (
        "a reading whose `.get` contradicts its own `.items()` produced no divergence: the "
        "cross-check does not consult the accessor every validator judges through"
    )


def test_the_get_accessor_bypass_does_not_reach_a_pass(runner) -> None:
    """F134's claim driven end to end, which is where it is a security defect rather than a gap.

    GREEN since the cross-check landed; it was the INTENDED RED that proved F134 end to end and
    is now a regression control. Before the repair the copy was rebuilt from the `.items()` face,
    so the verdict was satisfied and the receipt attested `Internal: True`, while the same live
    object told `.get` — the accessor `observe.validate_internal_network` itself uses — that the
    network is not internal.

    This must turn GREEN only by cross-checking `.get` in `views.stored_entries`, never by
    weakening an isolation control or relaxing this assertion.
    """
    assert run(runner, get_liar()).outcome != fakes.TOPOLOGY_PASS, (
        "a network reading that lies only to `.get` reached a topology pass: F134 is proved by "
        "execution and `proved_copy` does not close the two-faced class it claims to close"
    )
