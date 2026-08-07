"""F153: the leaf test is a membership test, so a metaclass forges leaf status.

F153 was filed **P1 NEW, PROVED-BY-EXECUTION** by cycle 3 (V2) while re-deriving the clearances in
`VERDICT-abf4d5f`. That verdict cleared F135's repair on the argument that

    type(stored) in IMMUTABLE_LEAVES

is *"an exact-type test that subclasses cannot satisfy"*, the same argument `_states_the_same_value`
makes in its own docstring: that equality is consulted "only where the comparison belongs to the
interpreter rather than to the reading". **The code does not implement that argument.** `in` on a
tuple is `any(e is x or e == x)`, so it consults `type.__eq__` — and a *metaclass* may override it.
A class whose metaclass answers `True` to every comparison is therefore admitted as a builtin leaf,
and the whole fail-closed chain below that admission unfolds on a lie.

This is not a restatement of F135. F135 was an `__eq__` on the *instances*, and its repair correctly
stopped consulting that one. F153 is an `__eq__` on the *type*, consulted by the very test that was
introduced to decide when instance equality is safe to trust. The repair's guard is itself forged,
so closing F135 did not narrow this: the range's doubles (`EqLiar`, `LiesOnlyToGet`) are plain
`dict` subclasses and no test in the range constructs a metaclass, which is exactly why an
execution-backed suite is required rather than another reading of the source.

One root cause reaches three sites, all of them controls this range was convened to establish:

* `views.immutability_findings` — a forged leaf is graded deeply immutable, unwalked.
* `views._states_the_same_value` — F135's repaired fallback, reached through the forgery.
* `views.proved_copy` — F136's deep walk short-circuits at the forged leaf.

`views._dead_copy`'s `isinstance(value, IMMUTABLE_LEAVES)` arm is **deliberately excluded**. Its docstring
states the opposite intent on purpose — "a safe scalar's subclass is a leaf here" — because `str`
and `bytes` are `Sequence`s and walking one yields its own characters. That site is subclass-
permitting by design; changing it would be a different decision on different evidence.

Anti-vacuity discipline, inherited from `test_f134_get_accessor` and `test_f135_eq_fallback`: every
refusal case is paired with a positive control proving the value really is two-faced, and with a
vacuity control proving a genuine leaf is still accepted after the repair. A fix that simply
refused everything would pass the refusals and fail the controls.
"""

from __future__ import annotations

from types import MappingProxyType

import pytest
from conftest import load_c8, require_c8_attr

ATTACHMENT_KEY = "Containers"


@pytest.fixture(name="views")
def views_module():
    return load_c8("views")


class ForgingLeafType(type):
    """A metaclass that claims its class *is* every builtin leaf type.

    Nothing exotic is required of the interpreter here: `x in (a, b)` is defined as
    `any(e is x or e == x for e in (a, b))`, so the membership test consults `__eq__` on the
    class object, and a metaclass owns that. `__hash__` is kept only so the class stays usable
    in the ordinary ways a type is; the membership test itself never hashes.
    """

    def __eq__(cls, other: object) -> bool:
        return True

    def __ne__(cls, other: object) -> bool:
        return False

    def __hash__(cls) -> int:
        return hash(int)


class TwoFacedLeaf(int, metaclass=ForgingLeafType):
    """An `int` subclass that forges leaf status at the type level and lies at the value level."""

    def __eq__(self, other: object) -> bool:
        return True

    def __ne__(self, other: object) -> bool:
        return False

    def __hash__(self) -> int:
        return 0


def two_faced_mapping():
    """A reading whose stored face states 1 and whose read faces state 2.

    The two faces are distinct objects stating genuinely different integers. They share a type,
    and that type forges membership of `IMMUTABLE_LEAVES`, which is all the repaired fallback
    asks before it hands the verdict back to the judged object.
    """

    class TwoFaced(dict):
        def __getitem__(self, key):
            if key == ATTACHMENT_KEY:
                return TwoFacedLeaf(2)
            return super().__getitem__(key)

        def get(self, key, default=None):
            if key == ATTACHMENT_KEY:
                return TwoFacedLeaf(2)
            return super().get(key, default)

    return TwoFaced({ATTACHMENT_KEY: TwoFacedLeaf(1)})


# --------------------------------------------------------------------------------------------
# Premises. If these fail, every refusal below is vacuous.
# --------------------------------------------------------------------------------------------


def test_the_forged_type_is_not_actually_a_builtin_leaf(views) -> None:
    """Premise. The type really is outside the leaf tuple by identity, and really forges `in`."""
    leaves = require_c8_attr(views, "IMMUTABLE_LEAVES")
    stored = TwoFacedLeaf(1)

    assert not any(leaf is type(stored) for leaf in leaves)
    assert type(stored) is not int
    assert type(stored) in leaves  # the forgery itself


def test_the_two_faces_state_genuinely_different_values() -> None:
    """Premise. The divergence is real at the integer level, not merely a claim about equality."""
    reading = two_faced_mapping()
    stored = dict(reading.items())[ATTACHMENT_KEY]
    subscripted = reading[ATTACHMENT_KEY]
    fetched = reading.get(ATTACHMENT_KEY)

    assert int(stored) == 1
    assert int(subscripted) == 2
    assert int(fetched) == 2
    assert stored is not subscripted
    assert type(subscripted) is type(stored)


# --------------------------------------------------------------------------------------------
# The three forged sites. RED until the leaf test is decided by identity.
# --------------------------------------------------------------------------------------------


def test_agreement_refuses_a_metaclass_forged_leaf(views) -> None:
    """`views._states_the_same_value` — F135's repaired fallback, reached through a forged guard.

    Two objects stating 1 and 2 must not be declared to state the same value.
    """
    same = require_c8_attr(views, "_states_the_same_value")
    assert same(TwoFacedLeaf(1), TwoFacedLeaf(2)) is False


def test_immutability_findings_reports_a_metaclass_forged_leaf(views) -> None:
    """`views.immutability_findings` — a forged leaf must not be graded deeply immutable."""
    findings = require_c8_attr(views, "immutability_findings")(TwoFacedLeaf(1), "probe")
    assert findings != ()


def test_proved_copy_reports_a_metaclass_forged_leaf(views) -> None:
    """`views.proved_copy` — F136's deep walk must not short-circuit at a forged leaf."""
    _, findings, _ = require_c8_attr(views, "proved_copy")(TwoFacedLeaf(1), "probe")
    assert findings != ()


def test_stored_entries_records_the_divergence_through_the_forged_leaf(views) -> None:
    """The cross-check that binds `.items()`, `__getitem__` and `.get` must report this reading."""
    _, divergence = require_c8_attr(views, "stored_entries")(two_faced_mapping(), "network")
    assert divergence != ()


# --------------------------------------------------------------------------------------------
# Vacuity controls. A repair that refuses everything fails here.
# --------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "value", [True, False, 0, 1, -3, 2.5, 1 + 2j, "text", b"bytes", None]
)
def test_genuine_builtin_leaves_are_still_leaves(views, value) -> None:
    """Every real leaf keeps its status: the repair narrows nothing that was honest."""
    assert require_c8_attr(views, "immutability_findings")(value, "probe") == ()
    _, findings, refusals = require_c8_attr(views, "proved_copy")(value, "probe")
    assert findings == ()
    assert refusals == ()


@pytest.mark.parametrize("value", [1, "text", b"bytes", 2.5, True, None])
def test_equal_genuine_leaves_still_agree(views, value) -> None:
    """The honest rebuilding case the fallback exists for still passes."""
    same = require_c8_attr(views, "_states_the_same_value")
    rebuilt = type(value)(value) if value is not None else None
    assert same(value, rebuilt) is True


def test_an_honest_mapping_of_leaves_still_shows_no_divergence(views) -> None:
    """Vacuity control for the cross-check: an honest reading is still clean."""
    honest = MappingProxyType({ATTACHMENT_KEY: 1, "Name": "net", "Internal": True})
    stored, divergence = require_c8_attr(views, "stored_entries")(honest, "network")
    assert divergence == ()
    assert stored[ATTACHMENT_KEY] == 1
