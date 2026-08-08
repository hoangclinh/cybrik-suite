"""P2-2: the `str`/`bytes` branches raise `TypeError` on a value whose `__class__` lies.

Filed **P2 (NEW)** by `VERDICT-6d20929` (ledger `Cycle 9/48`) against the `str` and `bytes`
family guards inside `views._dead_copy` and the unbound slot calls they select, plus the module's
totality claims. **This defect was introduced by the P1-1 repair at `6d20929`** — a regression
this lane authored — and it is repaired ahead of the findings carried in from earlier cycles.

Citations here name **symbols, not line numbers** (F0017). The previous coordinates — `:329`,
`:334`, `:333`, `:337`, `proved_copy:465` — had all rotted as `views.py` grew toward its
800-line bound, and a reader who followed them landed in unrelated code.

The vector is not the F153 metaclass forgery and not the P1-1 inheritance case. It is CPython's
`isinstance` fallback: when the direct `PyType_IsSubtype` check fails, `object_isinstance` reads
the instance's `__class__` attribute and accepts the value if *that* answers a subtype. A class
whose real type is unrelated to `str` can therefore publish `__class__ = str` and pass it.
The call the branch then makes is the unbound builtin slot `str.__str__`, chosen precisely
because it does **not** consult the instance — so it rejects the imposter with
`TypeError: descriptor '__str__' for 'str' objects doesn't apply to a '...' object`. The guard
asks the object, the call asks the interpreter, and the two disagree.

Neither call is inside a `try`, and `proved_copy` does not guard `_dead_copy`, so the raise
leaves the seam. That breaks the module's stated totality contract. It is **not** graded a
bypass, and the verdict says why: every seam that reaches `proved_copy` (in `runner` and at both
`preparation` call sites) catches broad `Exception`, so the raise fails *closed* into a stop
control. Nothing is admitted that should have been refused. It is a totality defect.

**The post-repair route, measured rather than assumed (F0010).** The earlier claim that this
object "returns `(value, ())` without raising" is **false as a description of the repaired code**,
and discarding the divergence tuple is what kept that false. Measured at `3188cc5`, the walk
returns the value uncopied together with exactly one divergence finding:

    top.<value>: this container raised TypeError when a dead copy of it was built,
    so no copy of it exists to record

The route is worth stating plainly, because it is not the one the reader expects. The repaired
family guard `issubclass(type(value), str)` does reject the imposter, exactly as intended — and
the value then falls through to the container arm, whose test is `isinstance(value, (AbstractSet,
Sequence))`. `str` is a registered `Sequence`, so the forged `__class__` fools **that** guard too,
the member walk tries to iterate an object that is not iterable, and the arm's broad handler
converts the `TypeError` into a divergence report.

So the forgery is stopped at the leaf family and then re-admitted, one arm lower, by a second
ask-the-object test. It still fails **closed**: nothing is copied, nothing is proved, and the
divergence channel states why. This is recorded here rather than repaired here — `views.py` is at
its 800-line bound and the container arm is outside this cut's scope — and it is declared to the
reviewer in the accompanying request rather than left for the tests to imply.

The repair decides leaf-family membership from the **real** type — `issubclass(type(value), str)`
— which `__class__` cannot forge, because both operands are ordinary types and the check resolves
to `PyType_IsSubtype`, the same relation the slot call itself requires. The guard and the call are
then asking one question instead of two.

Anti-vacuity discipline, inherited from `test_f153_metaclass_leaf` and
`test_p1_1_dead_copy_leaf_subclass`: the forgery is proved real by a positive control before any
refusal is asserted, and honest `str`/`bytes` subclasses plus exact leaves are held to their
existing copy behaviour so that a repair which simply stopped copying would fail. Every case goes
through the public `proved_copy` seam rather than calling the private function directly.

That is deliberately **not** the same as "every case reaches `_dead_copy`", and stating it that
way was F0016. The seven exact leaves in `test_exact_leaves_are_untouched_by_the_repair` are
settled by the immutable-leaf check and return before `_dead_copy` is entered at all; they are a
control on the walk's *entry* condition, not on the branch under repair. The forgery and honest
subclass cases are the ones that reach the branch.

Nothing here executes an entrypoint, opens a socket or touches Docker. RUNTIME stays HOLD.
"""

from __future__ import annotations

from types import MappingProxyType

import pytest
from conftest import load_c8, require_c8_attr

FIELD = "field"
TEXT = "plain-text-face"
RAW = b"raw-bytes-face"


class ForgedStrClass:
    """Real type unrelated to `str`; `__class__` answers `str` so `isinstance` is fooled.

    This needs no metaclass. `__class__` is an ordinary property here, which is the whole point:
    the interpreter's `isinstance` consults it, and the unbound `str.__str__` slot does not.
    """

    @property
    def __class__(self):  # type: ignore[override]
        return str


class ForgedBytesClass:
    """The same forgery for the `bytes` branch and its whole-slice subscript."""

    @property
    def __class__(self):  # type: ignore[override]
        return bytes


class HonestStrSubclass(str):
    """A genuine `str` subclass — the vacuity control for the copy that must still happen."""


class HonestBytesSubclass(bytes):
    """A genuine `bytes` subclass — the vacuity control for the `bytes` branch."""


@pytest.fixture
def views():
    return load_c8("views")


@pytest.fixture
def proved_copy(views):
    return require_c8_attr(views, "proved_copy")


def _walk(proved_copy, value):
    """Reach `_dead_copy` through the public seam, with `value` nested one level below the top."""
    top = MappingProxyType({FIELD: value})
    copied, findings, diverged = proved_copy(top, "top")
    return copied[FIELD], findings, diverged


def test_the_forgery_really_fools_isinstance(views):
    """Positive control: without this, both refusals below could pass vacuously.

    It also pins the exact reason the branch is entered — `isinstance` is `True` while the real
    type is not a subclass of `str` at all — so a later reader cannot mistake this for the
    inheritance case that P1-1 covered.
    """
    forged = ForgedStrClass()
    assert isinstance(forged, str)
    assert not issubclass(type(forged), str)
    assert type(forged) is ForgedStrClass

    forged_bytes = ForgedBytesClass()
    assert isinstance(forged_bytes, bytes)
    assert not issubclass(type(forged_bytes), bytes)

    is_immutable_leaf = require_c8_attr(views, "is_immutable_leaf")
    assert not is_immutable_leaf(forged)
    assert not is_immutable_leaf(forged_bytes)


def test_the_slot_call_is_what_rejects_the_imposter():
    """Pins the mechanism itself, independently of our code, so the finding cannot rot.

    If a future CPython made the unbound slot accept a forged `__class__`, this control fails and
    the reasoning above must be re-derived rather than silently trusted.
    """
    with pytest.raises(TypeError):
        str.__str__(ForgedStrClass())
    with pytest.raises(TypeError):
        bytes.__getitem__(ForgedBytesClass(), slice(None))


def test_forged_str_class_does_not_raise_out_of_the_seam(proved_copy):
    """The `str` family guard admits no imposter, and no `TypeError` leaves `_dead_copy`.

    The divergence tuple is bound and asserted (F0010). Discarding it as `_` was the finding: it
    left the module's account of what happens to this object asserted nowhere, and hid the fact
    that the value is refused by the *container* arm rather than returned cleanly.
    """
    forged = ForgedStrClass()
    value, findings, diverged = _walk(proved_copy, forged)
    assert value is forged
    assert any("not deeply immutable" in finding for finding in findings)

    # Pin the exact route, not merely that something diverged (F0028): a bare truthiness check
    # would pass just as readily if the value had diverged for an unrelated reason.
    assert len(diverged) == 1
    assert diverged[0] == (
        "top.<value>: this container raised TypeError when a dead copy of it was built, "
        "so no copy of it exists to record"
    )


def test_forged_bytes_class_does_not_raise_out_of_the_seam(proved_copy):
    """The same for the `bytes` family guard and the whole-slice subscript."""
    forged = ForgedBytesClass()
    value, findings, diverged = _walk(proved_copy, forged)
    assert value is forged
    assert any("not deeply immutable" in finding for finding in findings)

    assert len(diverged) == 1
    assert diverged[0] == (
        "top.<value>: this container raised TypeError when a dead copy of it was built, "
        "so no copy of it exists to record"
    )


def test_the_forged_value_is_refused_by_the_container_arm_not_returned_clean(proved_copy):
    """Pins the second ask-the-object guard the forgery survives, so the route cannot rot.

    `str` is a registered `Sequence`, so `isinstance(forged, Sequence)` is `True` even though the
    real type is unrelated. This control fails if a future repair closes the container arm against
    forged `__class__` — at which point the divergence assertions above must be re-derived rather
    than silently adjusted to whatever the code then does.
    """
    from collections.abc import Sequence

    forged = ForgedStrClass()
    assert isinstance(forged, Sequence)
    assert not issubclass(type(forged), Sequence)
    with pytest.raises(TypeError):
        iter(forged)

    # F0044: the three assertions above pin CPython's registration semantics, not this repair.
    # Without driving the value through `proved_copy` the control cannot fail on any change to
    # the container arm, which is the only thing its name and docstring promise.
    value, findings, diverged = _walk(proved_copy, forged)
    assert value is forged, "the container arm must refuse the forgery, not return a copy of it"
    assert any("not deeply immutable" in finding for finding in findings)
    assert len(diverged) == 1
    assert diverged[0] == (
        "top.<value>: this container raised TypeError when a dead copy of it was built, "
        "so no copy of it exists to record"
    )


def test_honest_str_subclass_is_still_copied_to_its_exact_leaf(proved_copy):
    """Vacuity control: the repair must not stop copying genuine subclasses."""
    value, _, _ = _walk(proved_copy, HonestStrSubclass(TEXT))
    assert type(value) is str
    assert value == TEXT


def test_honest_bytes_subclass_is_still_copied_to_its_exact_leaf(proved_copy):
    """Vacuity control for the `bytes` branch."""
    value, _, _ = _walk(proved_copy, HonestBytesSubclass(RAW))
    assert type(value) is bytes
    assert value == RAW


@pytest.mark.parametrize("leaf", [True, 7, 1.5, 2j, TEXT, RAW, None])
def test_exact_leaves_are_untouched_by_the_repair(proved_copy, leaf):
    """Vacuity control: nothing is widened — exact leaves still return unchanged."""
    value, _, _ = _walk(proved_copy, leaf)
    assert value is leaf
