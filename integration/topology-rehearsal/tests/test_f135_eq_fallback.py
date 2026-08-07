"""F135: the value-agreement fallback is decided by an `__eq__` the attacker owns on both sides.

F135 was filed **P1 OPEN, PROVED-BY-EXECUTION** by cycle 58's independent reviewer, and cycle 64
recorded it as the last standing prerequisite before F131's container repair can be legitimate.
Like F134, the reviewer's reproduction lived in a `/tmp` scratch tree and did not survive into the
repository, so it exists here only as prose. This module re-establishes it as a live executable RED.

The defect, exactly: `views._states_the_same_value` clears an entry when

    type(other) is type(stored) and (other == stored) is True and (stored == other) is True

Its docstring argues that demanding the exact same type, a literal `True`, and bidirectionality
defeats a lying comparison. It does not. **All three of those things are supplied by the hostile
reading itself:** both operands come from the same mapping, and so does the type they share. An
object that answers `True` to every comparison satisfies the whole conjunction while its two views
state different values. The cross-check that exists to bind `.items()`, `__getitem__` and `.get`
together is therefore decided by code the judged object wrote.

This is not the same hole as F134. F134 was an accessor never consulted; F135 is an accessor that
*is* consulted and whose answer is then adjudicated by the attacker. Closing F134 did not narrow it:
a liar need only present its two faces as objects that claim equality.

Anti-vacuity discipline, inherited from `test_f131_ingress_guard` and `test_f134_get_accessor`:
every case is built on the real `fakes.network_projection()` shape, paired with a positive control
proving the reading is hostile by the package's own standard, and a vacuity control proving an
honest reading of the same shape still reaches `TOPOLOGY_PASS`.
"""

from __future__ import annotations

from types import MappingProxyType

import documents
import fakes
import pytest
from conftest import load_c8, require_c8_attr

ATTACHMENT_KEY = "Containers"


@pytest.fixture(name="views")
def views_module():
    return load_c8("views")


@pytest.fixture(name="observe")
def observe_module():
    return load_c8("observe")


@pytest.fixture(name="runner")
def runner_module():
    return load_c8("runner")


class EqLiar(dict):
    """An attachment mapping that claims equality with anything, in both directions.

    A real Docker `Containers` reading is a plain `dict`, so this is one. Nothing here is exotic:
    it answers `True` — the literal, not merely something truthy — to every comparison, which is
    the one thing `_states_the_same_value` asks of it.
    """

    def __eq__(self, other: object) -> bool:
        return True

    def __ne__(self, other: object) -> bool:
        return False

    __hash__ = None  # type: ignore[assignment]


def one_attachment() -> EqLiar:
    return EqLiar({fakes.CONTAINER_NAME: {"Name": fakes.CONTAINER_NAME}})


def two_attachments() -> EqLiar:
    return EqLiar(
        {
            fakes.CONTAINER_NAME: {"Name": fakes.CONTAINER_NAME},
            "ATTACKER": {"Name": "ATTACKER"},
        }
    )


def eq_liar_projection():
    """A network reading whose stored face holds one attachment and whose read faces hold two.

    The two faces are distinct objects stating genuinely different values — one attachment versus
    two, which is the difference between the reviewed isolation and a second party on the network.
    They share a type and claim equality, which is all the fallback demands.
    """

    class TwoFaced(dict):
        def __getitem__(self, key):
            if key == ATTACHMENT_KEY:
                return two_attachments()
            return super().__getitem__(key)

        def get(self, key, default=None):
            if key == ATTACHMENT_KEY:
                return two_attachments()
            return super().get(key, default)

    return TwoFaced(fakes.network_projection(internal=True, containers=one_attachment()))


def run(runner, network):
    return require_c8_attr(runner, "run_topology_rehearsal")(
        documents.authorization(),
        fakes.passing_adapters(network=network),
        execute_requested=True,
    )


def test_the_two_faces_state_different_values_while_claiming_equality() -> None:
    """Premise. If the faces agreed, or refused to compare, every case below would be vacuous."""
    reading = eq_liar_projection()
    stored = dict(reading.items())[ATTACHMENT_KEY]
    subscripted = reading[ATTACHMENT_KEY]
    fetched = reading.get(ATTACHMENT_KEY)

    assert len(stored) == 1
    assert len(subscripted) == 2
    assert len(fetched) == 2
    assert stored is not subscripted
    assert type(subscripted) is type(stored)
    assert (subscripted == stored) is True
    assert (stored == subscripted) is True


def test_the_package_validator_refuses_the_live_reading(observe) -> None:
    """Positive control: the reading is hostile by this package's own standard.

    `validate_internal_network` reads `projection.get("Containers")` and requires exactly one
    attachment. Handed the live object it refuses it, so any pass reached below is a bypass and
    not a difference of opinion.
    """
    verdict = require_c8_attr(observe, "validate_internal_network")(eq_liar_projection())
    assert verdict.satisfied is False


def test_the_honest_network_reading_still_passes(runner) -> None:
    """Vacuity control. Without this, a refusal below could be mere shape rejection."""
    assert run(runner, fakes.network_projection(internal=True)).outcome == fakes.TOPOLOGY_PASS


def test_an_attacker_owned_eq_does_not_decide_agreement(views) -> None:
    """F135's claim at the unit boundary.

    INTENDED RED while the fallback consults `==` on objects the reading supplies. The stored face
    and the read faces state different values, so the two views of one entry disagree and the
    reading must be refused — not cleared because it asserted its own honesty.
    """
    _, _, divergence = require_c8_attr(views, "proved_copy")(
        MappingProxyType(eq_liar_projection()), "network"
    )
    assert divergence, (
        "a reading whose faces state one attachment and two produced no divergence: agreement "
        "was decided by an `__eq__` defined by the object being judged"
    )


def test_the_eq_fallback_bypass_does_not_reach_a_pass(runner) -> None:
    """F135's claim driven end to end, which is where it is a security defect rather than a gap.

    INTENDED RED. The copy is rebuilt from the one-attachment `.items()` face, so the verdict is
    satisfied and the receipt attests the reviewed isolation, while the same live object tells
    `.get` — the accessor `observe.validate_internal_network` itself uses — that a second party is
    attached to the network.

    This must turn GREEN only by removing the attacker-owned comparison from the agreement
    decision, never by weakening an isolation control or relaxing this assertion.
    """
    assert run(runner, eq_liar_projection()).outcome != fakes.TOPOLOGY_PASS, (
        "a network reading whose two faces differ but claim equality reached a topology pass: "
        "F135 is proved by execution and the agreement fallback is attacker-decided"
    )
