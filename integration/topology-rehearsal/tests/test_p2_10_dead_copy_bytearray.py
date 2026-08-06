"""P2-10: the `bytearray` arm of `_dead_copy` trusts the judged object twice.

`VERDICT-af0d227` re-graded this lane's self-derived `S10-1` to **P2-10** and prescribed
`issubclass(type(value), bytearray)` as the smallest correction. This lane executed the site
before repairing it and found the prescribed correction **necessary but not sufficient**, so the
repair is wider than the one prescribed and the extra width is declared here rather than assumed.

Two distinct defects live on these two lines, and only the first is the one the verdict traced.

**Vector 1 — the forged `__class__` (the verdict's trace, a raise).** `isinstance(value,
bytearray)` falls back to the instance's `__class__`, so a class of unrelated real type that
publishes `__class__ = bytearray` passes the guard; `bytes(value)` then looks for `__bytes__` and
the buffer protocol on the *real* type, finds neither, and raises `TypeError` out of a seam whose
docstring promises totality. This is `P2-2` with one word changed, and `issubclass(type(value),
bytearray)` does close it.

**Vector 2 — ordinary inheritance, and it is silent (this lane's finding, NOT in the verdict).**
`bytes(value)` dispatches to a `__bytes__` that a `bytearray` *subclass* owns. No forgery is
needed and no `__class__` is touched, so `issubclass(type(value), bytearray)` answers `True` and
admits it exactly as `isinstance` did — the prescribed correction does not see this at all. The
attacker's `__bytes__` then *becomes the recorded dead copy*, and `_dead_copy` returns it with an
**empty divergence tuple**: the seam reports no disagreement while handing back a value the judged
object chose. That is strictly worse than vector 1, which at least failed closed into a stop
control, and it is the same "the object graded itself" shape as `F135`, `F153` and `P1-1`.

The repair therefore takes the copy through `bytearray.__getitem__(value, slice(None))` — the
builtin slot, which resolves on the real type and cannot be intercepted by a Python-level subclass
— and then converts the resulting *exact* `bytearray` with `bytes()`, which is safe precisely
because an exact `bytearray` has no `__bytes__` to consult. This is the same reasoning the
`str`/`bytes` arms already use, applied to the one arm that was left behind.

Every case reaches `_dead_copy` through the public `proved_copy` seam. None of these values is an
immutable leaf, so none can short-circuit at `proved_copy` before the arm under test — that is
asserted, not assumed, because `P3-6` filed exactly that unchecked claim against this lane's last
suite. The divergence tuple is asserted on rather than discarded, because `P2-9` showed that
discarding it hid the route an imposter actually takes.
"""

from __future__ import annotations

import pytest

from cybrik_suite_topology_rehearsal.views import proved_copy


class HostileBytesSubclass(bytearray):
    """An ordinary `bytearray` subclass. No forgery: `__class__` is untouched."""

    def __bytes__(self) -> bytes:  # pragma: no cover - the defect is that this DOES run
        return b"ATTACKER_CHOSE_THIS"


class HonestBytesSubclass(bytearray):
    """A `bytearray` subclass that plays fair, to prove the repair does not simply stop."""


class ForgedBytearrayClass:
    """Unrelated real type that publishes `__class__ = bytearray` (the verdict's vector)."""

    @property
    def __class__(self):  # type: ignore[override]
        return bytearray


# --- positive controls: the vectors are real before anything is asserted about the repair ---


def test_isinstance_is_genuinely_fooled_by_the_forged_class() -> None:
    """If this fails the forged vector is a strawman and vector 1 proves nothing."""
    assert isinstance(ForgedBytearrayClass(), bytearray) is True
    assert type(ForgedBytearrayClass()) is not bytearray


def test_the_prescribed_correction_alone_would_not_see_vector_two() -> None:
    """`issubclass(type(v), bytearray)` admits the hostile subclass — this is why the repair is wider."""
    assert issubclass(type(HostileBytesSubclass(b"x")), bytearray) is True
    assert issubclass(type(ForgedBytearrayClass()), bytearray) is False


def test_bytes_genuinely_consults_a_subclass_dunder_bytes() -> None:
    """Pins the CPython mechanism directly, so the control fails loudly instead of rotting."""
    assert bytes(HostileBytesSubclass(b"honest")) == b"ATTACKER_CHOSE_THIS"
    assert bytearray.__getitem__(HostileBytesSubclass(b"honest"), slice(None)) == bytearray(b"honest")


# --- vacuity controls: these values must actually reach the arm under test ---


@pytest.mark.parametrize(
    "value",
    [HostileBytesSubclass(b"honest"), HonestBytesSubclass(b"plain"), bytearray(b"exact")],
)
def test_the_bytearray_arm_is_genuinely_entered(value: object) -> None:
    """None of these is an immutable leaf, so none short-circuits before the arm (P3-6)."""
    from cybrik_suite_topology_rehearsal.views import IMMUTABLE_LEAVES

    assert not any(leaf is type(value) for leaf in IMMUTABLE_LEAVES)
    copied, _immutability, _divergence = proved_copy(value, "top")
    assert type(copied) is bytes


# --- the defect itself ---


def test_vector_two_the_copy_comes_from_the_real_buffer_not_from_attacker_code() -> None:
    """RED before the repair: the recorded copy is whatever `__bytes__` returned, reported clean."""
    hostile = HostileBytesSubclass(b"honest")
    copied, immutability, divergence = proved_copy(hostile, "top")

    assert copied == b"honest", "the dead copy must come from the real buffer"
    assert copied != b"ATTACKER_CHOSE_THIS", "attacker code chose the recorded copy"
    assert type(copied) is bytes
    # The seam stayed silent while substituting, which is what makes vector 2 worse than vector 1.
    assert divergence == ()
    assert immutability == ("top holds a HostileBytesSubclass, which is not deeply immutable",)


def test_vector_one_the_forged_bytearray_does_not_raise_out_of_the_seam() -> None:
    """RED before the repair: `bytes(value)` raises TypeError through a seam promising totality.

    This lane first asserted `divergence == ()` here, on the assumption that the repaired guard
    drops the imposter through to the uncopied return. **That assumption was wrong, and the test
    caught it** — which is `P2-9` reproduced at a third site by measurement rather than restated.
    `MutableSequence.register(bytearray)` means the `AbstractSet`/`Sequence` arm asks
    `ABCMeta.__instancecheck__`, which reads `__class__` *before* the real type, so the imposter
    is admitted there, `iter()` fails on its real type, and the `TypeError` is caught and reported
    as a divergence finding. So the totality promise is kept, but by that arm's `try`, not by any
    fall-through — and the third `isinstance` in this function still decides family membership by
    asking the object. That is `P2-9`, still open, now confirmed to reach `bytearray` too; it is
    recorded, not repaired here, because one finding per cycle is the standing directive.
    """
    forged = ForgedBytearrayClass()
    copied, immutability, divergence = proved_copy(forged, "top")

    assert copied is forged, "an imposter is returned live and uncopied"
    assert immutability == ("top holds a ForgedBytearrayClass, which is not deeply immutable",)
    # Fails closed with a finding rather than raising. Asserted, not discarded — P2-9's lesson.
    assert divergence == (
        (
            "top: this container raised TypeError when a dead copy of it was built, "
            "so no copy of it exists to record"
        ),
    )


def test_an_honest_subclass_is_still_copied_to_an_exact_leaf() -> None:
    """The repair must not close the finding by simply refusing to copy."""
    copied, _immutability, divergence = proved_copy(HonestBytesSubclass(b"plain"), "top")
    assert copied == b"plain"
    assert type(copied) is bytes
    assert divergence == ()


def test_an_exact_bytearray_is_unaffected_by_the_repair() -> None:
    copied, _immutability, divergence = proved_copy(bytearray(b"exact"), "top")
    assert copied == b"exact"
    assert type(copied) is bytes
    assert divergence == ()
