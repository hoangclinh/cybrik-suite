"""P2-2: the `str`/`bytes` branches raise `TypeError` on a value whose `__class__` lies.

Filed **P2 (NEW)** by `VERDICT-6d20929` (ledger `Cycle 9/48`), defect `views.py:329` and `:334`
against the slot calls at `:333` and `:337`, false totality claims at `views.py:5-7` and
`:415-416`. **This defect was introduced by the P1-1 repair at `6d20929`** — a regression this
lane authored — and it is repaired ahead of the findings carried in from earlier cycles.

The vector is not the F153 metaclass forgery and not the P1-1 inheritance case. It is CPython's
`isinstance` fallback: when the direct `PyType_IsSubtype` check fails, `object_isinstance` reads
the instance's `__class__` attribute and accepts the value if *that* answers a subtype. A class
whose real type is unrelated to `str` can therefore publish `__class__ = str` and pass `:329`.
The call the branch then makes is the unbound builtin slot `str.__str__`, chosen precisely
because it does **not** consult the instance — so it rejects the imposter with
`TypeError: descriptor '__str__' for 'str' objects doesn't apply to a '...' object`. The guard
asks the object, the call asks the interpreter, and the two disagree.

Neither call is inside a `try`, and `proved_copy:465` does not guard `_dead_copy`, so the raise
leaves the seam. That breaks the module's stated totality contract. It is **not** graded a
bypass, and the verdict says why: every seam that reaches `proved_copy` (`runner.py:476`,
`preparation.py:287`, `:314`) catches broad `Exception`, so the raise fails *closed* into a stop
control. Nothing is admitted that should have been refused. It is a totality defect, and the
pre-repair line returned `(value, ())` for this same object without raising.

The repair decides leaf-family membership from the **real** type — `issubclass(type(value), str)`
— which `__class__` cannot forge, because both operands are ordinary types and the check resolves
to `PyType_IsSubtype`, the same relation the slot call itself requires. The guard and the call are
then asking one question instead of two.

Anti-vacuity discipline, inherited from `test_f153_metaclass_leaf` and
`test_p1_1_dead_copy_leaf_subclass`: the forgery is proved real by a positive control before any
refusal is asserted, and honest `str`/`bytes` subclasses plus exact leaves are held to their
existing copy behaviour so that a repair which simply stopped copying would fail. Every case
reaches `_dead_copy` through the public `proved_copy` seam rather than calling the private
function directly, so no assertion here can pass without entering the branch it guards.

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
    """The defect: `:329` admits the imposter and `:333` raises `TypeError` out of `_dead_copy`."""
    forged = ForgedStrClass()
    value, findings, _ = _walk(proved_copy, forged)
    assert value is forged
    assert any("not deeply immutable" in finding for finding in findings)


def test_forged_bytes_class_does_not_raise_out_of_the_seam(proved_copy):
    """The same for `:334`/`:337` and the whole-slice subscript."""
    forged = ForgedBytesClass()
    value, findings, _ = _walk(proved_copy, forged)
    assert value is forged
    assert any("not deeply immutable" in finding for finding in findings)


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
