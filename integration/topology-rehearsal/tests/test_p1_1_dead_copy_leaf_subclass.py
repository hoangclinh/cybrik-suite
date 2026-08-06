"""P1-1: `_dead_copy` hands back a leaf *subclass* live and uncopied, cross-checking nothing.

Filed **P1** by `VERDICT-a703a45` (ledger `Cycle 6/48`), defect `views.py:311`, false invariant
`views.py:298-299`. `isinstance(value, IMMUTABLE_LEAVES)` at `:311` returns the caller's live
object with zero divergence findings. A class subclassing `str` *and* `Mapping` passes that test
**by ordinary inheritance — no metaclass forgery is required**, so `_dead_mapping` is never called
and the mapping face of a two-faced value is never reconciled against itself.

This is not F153 again. F153 was a forged *exact-type* answer at `:84`, `:154` and `:405`, and its
repair (`_is_immutable_leaf`, identity) is sound at those three sites. `:311` was **deliberately
excluded** from that repair — `test_f153_metaclass_leaf`'s module docstring says so, on the stated
ground that `str` and `bytes` are `Sequence`s and walking one yields its own characters. That
ground is real and is preserved here: the repair must not take a scalar subclass apart into
characters. What the ground does not justify is skipping the **Mapping** face, which is what these
tests hold.

`views.py:298-299` claims `_dead_copy` aligns with `preparation.frozen`. It does not:
`preparation.py:133-141` *refuses* a scalar subclass outright. The two functions are opposites at
exactly this boundary, and the docstring is corrected with the repair.

Anti-vacuity discipline, inherited from `test_f134_get_accessor`, `test_f135_eq_fallback` and
`test_f153_metaclass_leaf`: every refusal case is paired with a positive control proving the double
really is two-faced, and with vacuity controls proving genuine leaves and honest scalar subclasses
are still accepted after the repair. A fix that simply walked or refused everything would pass the
refusals and fail the controls.

Nothing here executes an entrypoint, opens a socket or touches Docker. RUNTIME stays HOLD.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType

import pytest
from conftest import load_c8, require_c8_attr

FIELD = "field"
STORED = "what-the-mapping-stores"
ATTACKER = "what-the-subscript-answers"


class TwoFacedStrMapping(str, Mapping):
    """A `str` subclass that is also a `Mapping` whose two views disagree.

    Ordinary inheritance only: no metaclass, no `__class__` property, nothing forged. `str`
    contributes the leaf face that `isinstance(value, IMMUTABLE_LEAVES)` accepts; `Mapping`
    contributes the face that carries the attacker's content.
    """

    def __iter__(self):  # keys, not the characters `str.__iter__` would yield
        return iter((FIELD,))

    def __len__(self):
        return 1

    def items(self):
        return ((FIELD, STORED),)

    def __getitem__(self, key):  # the second face
        return ATTACKER

    def get(self, key, default=None):  # the second face
        return ATTACKER


class HonestStrSubclass(str):
    """A `str` subclass carrying no second face — the vacuity control."""


class HonestBytesSubclass(bytes):
    """A `bytes` subclass carrying no second face — the vacuity control."""


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


def test_the_double_really_is_two_faced(views):
    """Positive control: without this, every refusal below could pass vacuously."""
    double = TwoFacedStrMapping("plain-text-face")
    assert dict(double.items()) == {FIELD: STORED}
    assert double[FIELD] == ATTACKER
    assert double.get(FIELD) == ATTACKER
    assert isinstance(double, str)
    assert isinstance(double, Mapping)
    stored_entries = require_c8_attr(views, "stored_entries")
    _, findings = stored_entries(double, "control")
    assert findings, "the double's two views must disagree when a mapping reader reads it"


def test_a_two_faced_leaf_subclass_is_reported_as_diverging(proved_copy):
    """P1-1 RED: the mapping face must be reconciled, not waved through by the `str` face."""
    _, _, diverged = _walk(proved_copy, TwoFacedStrMapping("plain-text-face"))
    assert diverged, (
        "a value that is both a str subclass and a two-faced Mapping reached _dead_copy and "
        "produced no divergence finding, so its second face was never cross-checked"
    )


def test_a_two_faced_leaf_subclass_is_not_recorded_live(proved_copy):
    """P1-1 RED: what is recorded must not be the object the caller still owns."""
    double = TwoFacedStrMapping("plain-text-face")
    copied, _, _ = _walk(proved_copy, double)
    assert copied is not double, (
        "_dead_copy returned the caller's live object, so what was recorded is still free to "
        "change after it was judged"
    )


def test_the_attacker_content_is_not_what_gets_recorded(proved_copy):
    """The recorded copy must come out of the read that was judged, not the second face."""
    copied, _, _ = _walk(proved_copy, TwoFacedStrMapping("plain-text-face"))
    assert ATTACKER not in repr(copied), (
        "the recorded copy carries content that no cross-check ever validated"
    )


def test_an_honest_str_subclass_is_not_taken_apart_into_characters(proved_copy):
    """Vacuity control: the ground `:311` was excluded from F153 on is preserved."""
    copied, _, diverged = _walk(proved_copy, HonestStrSubclass("abc"))
    assert copied == "abc"
    assert type(copied) is str, "a scalar subclass must be copied to its exact leaf type"
    assert not isinstance(copied, tuple), "a str must never be walked into its own characters"
    assert diverged == ()


def test_an_honest_bytes_subclass_is_not_taken_apart_into_its_bytes(proved_copy):
    """Vacuity control: the same ground, for `bytes`."""
    copied, _, diverged = _walk(proved_copy, HonestBytesSubclass(b"abc"))
    assert copied == b"abc"
    assert type(copied) is bytes, "a scalar subclass must be copied to its exact leaf type"
    assert not isinstance(copied, tuple), "bytes must never be walked into their own bytes"
    assert diverged == ()


@pytest.mark.parametrize("leaf", [True, 7, 1.5, 3 + 2j, "text", b"bytes", None])
def test_genuine_exact_leaves_are_still_returned_unchanged(proved_copy, leaf):
    """Vacuity control: the repair narrows nothing for real builtin leaves."""
    copied, _, diverged = _walk(proved_copy, leaf)
    assert copied is leaf
    assert diverged == ()
