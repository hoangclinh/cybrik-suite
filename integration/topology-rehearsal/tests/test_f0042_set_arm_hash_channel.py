"""F0042: the F0035 hash channel was closed at the dict-key arm only.

Filed **P2** against `preparation.frozen`. `VERDICT-3188cc5` graded the previous cycle's F0035
repair and found it under-cut by this lane: the `Mapping` arm wraps its comprehension in a
`try`/`except TypeError` that restates the failure as the `ValueError` the function contracts,
but the `AbstractSet` arm calls `frozenset(...)` on dead copies **outside any guard**.

The mechanism, measured rather than assumed. A `Mapping` subclass may define `__hash__`, so it
can legitimately sit inside a plain `set`. `frozen` rebuilds that member into a
`MappingProxyType`, which is **not** hashable, and the surrounding `frozenset()` then raises
`TypeError` — the raw interpreter error, escaping a function whose entire refusal contract is
`ValueError`.

Two distinct consequences, and both are asserted below because closing only one is how this
finding was created in the first place:

1. **Wrong exception type at the top.** `frozen({hashable_mapping})` raises `TypeError` where
   every other unprovable value raises `ValueError`. A caller written to the contract does not
   catch it.
2. **Misattribution one level up.** When that set is nested under a mapping, the inner
   `TypeError` propagates into the *outer* arm's handler, which reports `"has an unhashable dead
   copy key"`. That is false twice over: the culprit is a set **member**, not a key, and the type
   named is the outer container rather than the value that actually failed. A reader following
   that refusal looks at the wrong object.

The repair guards the set arm at its own seam, so the inner failure is restated as `ValueError`
where it happens and can no longer be caught by — or misdescribed by — the mapping arm above it.

Anti-vacuity discipline: `test_the_member_is_genuinely_hashable_and_its_copy_is_not` proves the
vector is real before any refusal is asserted, so a repair that merely stopped accepting sets, or
a fixture whose member was never hashable to begin with, would fail here rather than pass quietly.
The honest-set control holds ordinary sets to their existing copy behaviour, so a repair that
refused the whole arm would be caught.

Nothing here executes an entrypoint, opens a socket or touches Docker. RUNTIME stays HOLD.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType

import pytest
from conftest import load_c8, require_c8_attr


class HashableMapping(Mapping):
    """A real `Mapping` that is hashable, so it may legitimately be a member of a `set`.

    It inherits `Mapping`, so it is not a forgery and not the F0024 two-faced case: `frozen`
    is entirely right to treat it as a mapping. The defect is what happens to its dead copy
    afterwards.
    """

    def __init__(self, pairs: dict) -> None:
        self._pairs = dict(pairs)

    def __getitem__(self, key):
        return self._pairs[key]

    def __iter__(self):
        return iter(self._pairs)

    def __len__(self) -> int:
        return len(self._pairs)

    def __hash__(self) -> int:
        return 0

    def __eq__(self, other) -> bool:
        return self is other


@pytest.fixture
def preparation():
    return load_c8("preparation")


@pytest.fixture
def frozen(preparation):
    return require_c8_attr(preparation, "frozen")


def test_the_member_is_genuinely_hashable_and_its_copy_is_not(frozen):
    """Positive control: without this, both refusals below could pass vacuously.

    It pins the exact reason the arm fails — the member goes *into* a set without complaint and
    its dead copy will not go into a `frozenset` — so the defect cannot be mistaken for an
    ordinary unhashable value that never belonged in a set at all.
    """
    member = HashableMapping({"a": 1})
    assert hash(member) == 0
    assert {member} == {member}

    copied = frozen(member)
    assert isinstance(copied, MappingProxyType)
    with pytest.raises(TypeError):
        hash(copied)


def test_a_set_member_whose_dead_copy_is_unhashable_is_refused_as_a_value_error(frozen):
    """INTENDED RED until the set arm is guarded: the contract is `ValueError`, not `TypeError`."""
    with pytest.raises(ValueError) as refusal:
        frozen({HashableMapping({"a": 1})})

    message = str(refusal.value)
    assert "member" in message
    assert "key" not in message


def test_the_mapping_arm_no_longer_misattributes_the_set_failure_to_a_key(frozen):
    """INTENDED RED: the inner set failure was reported as an unhashable *key* of the outer dict.

    This is the half that makes the finding P2 rather than cosmetic. Pinning the exact route
    matters here (F0028): asserting a bare `ValueError` would pass against the very
    misattribution this test exists to refuse, because the buggy path raises `ValueError` too.
    """
    with pytest.raises(ValueError) as refusal:
        frozen({"outer": {HashableMapping({"a": 1})}})

    message = str(refusal.value)
    assert "member" in message
    assert "unhashable dead copy key" not in message


def test_honest_sets_are_still_copied_to_frozensets(frozen):
    """Vacuity control: the repair must not refuse the set arm at large."""
    copied = frozen({"a", "b"})
    assert type(copied) is frozenset
    assert copied == {"a", "b"}

    nested = frozen({("a", 1), ("b", 2)})
    assert type(nested) is frozenset
    assert nested == {("a", 1), ("b", 2)}
