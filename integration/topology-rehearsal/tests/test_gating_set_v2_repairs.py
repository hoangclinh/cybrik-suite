"""The six code mechanisms behind the open gating set, driven RED before any repair.

This module is deliberately *not* organised one-finding-per-file like its predecessors. The open
set injected by the driver carries six gating rows whose mechanisms overlap in two functions, and
repairing them one file at a time is what produced four verdicts with a single retirement. The
rows exercised here, with the mechanism each one names:

- **F0026** (`views.py`, P2) — `is_immutable_leaf`'s docstring says *any* caller deciding leaf
  status must call it rather than re-derive the test, and `preparation.frozen` re-derives both
  forbidden forms. The `type(...) in IMMUTABLE_LEAVES` form is forgeable by a metaclass `__eq__`
  and returns the live object uncopied out of the one function contracted to return a dead copy.
  The `isinstance(...)` form is *not* exploitable in the opening direction, but it is still a
  re-derivation of a test no caller may re-derive, so the control surface is false while it
  stands. Both are repaired; only the first is asserted as a bypass.
- **F0024** (`views.py`, P2) — `_dead_copy` checks the `Mapping` face before every buffer arm;
  `preparation.frozen` still checks `bytearray` first. A `bytearray`+`Mapping` hybrid is therefore
  copied on two different faces by the two functions that must agree, and `frozen` collapses it
  before `proved_copy` ever cross-checks it on the snapshot path.
- **F0023** (`views.py`, P2) — depth exhaustion returns an *empty* immutability channel while
  `immutability_findings` returns a finding at the same depth. `proved_copy:604-610` asserts the
  two are byte-identical, and `PreparationResult.__post_init__` refuses on that channel, so a
  projection nested past the bound is admitted with nothing said about it.
- **F0022** (`views.py`, P2) — the announced-key membership test hashes attacker-controlled keys
  outside every `try`, so an unhashable announced key escapes a seam contracted to return findings.
- **F0006** (`views.py`, P2) — six findings interpolate an attacker-controlled key bare, outside
  every `try`. A `__format__` that raises converts the *report* of a divergence into an exception,
  so the hostile reading suppresses the finding it triggered.
- **F0025** (`views.py`, P2) — `stored_entries`' docstring claims keys announced through `keys()`
  are reconciled and that the yielded count is checked against the stored count. Neither test
  exists: `_announced_keys` reads `iter()` alone, and duplicate keys collapse into `stored`
  unreported.

Anti-vacuity discipline is inherited from `test_f153_metaclass_leaf` and
`test_p2_2_dead_copy_class_forgery`: every forgery is proved to fool the interpreter by a positive
control before any refusal is asserted, and honest values are held to their existing behaviour so
that a repair which simply stopped copying, or started refusing everything, fails here.

Nothing here executes an entrypoint, opens a socket or touches Docker. RUNTIME stays HOLD.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType

import pytest
from conftest import load_c8, require_c8_attr

FIELD = "field"


@pytest.fixture
def views():
    return load_c8("views")


@pytest.fixture
def preparation():
    return load_c8("preparation")


@pytest.fixture
def stored_entries(views):
    return require_c8_attr(views, "stored_entries")


# --------------------------------------------------------------------------------------------
# F0026 — the leaf test re-derived in the admission path
# --------------------------------------------------------------------------------------------


class _LyingMeta(type):
    """A metaclass whose `__eq__` answers `True` to every class comparison."""

    def __eq__(cls, other):
        return True

    def __hash__(cls):
        return hash(id(cls))


class ForgedLeaf(metaclass=_LyingMeta):
    """Not a builtin leaf, but `type(x) in IMMUTABLE_LEAVES` says it is."""

    def __init__(self):
        self.mutated = []


def test_the_metaclass_forgery_really_fools_membership(views):
    """Positive control: without this the refusal below could pass vacuously."""
    immutable_leaves = require_c8_attr(views, "IMMUTABLE_LEAVES")
    is_immutable_leaf = require_c8_attr(views, "is_immutable_leaf")
    forged = ForgedLeaf()

    assert type(forged) in immutable_leaves, "the membership forgery no longer works"
    assert not is_immutable_leaf(forged), "identity must not be forgeable"


def test_frozen_does_not_hand_back_the_live_object(preparation):
    """F0026: `frozen` must never return the caller's live handle as its 'dead copy'.

    This is the graded F153 mechanism surviving in the admission path. `PreparationResult`
    rests on `frozen`, so the immutability of the snapshot rests on a check the judged
    object controls.
    """
    frozen = require_c8_attr(preparation, "frozen")
    forged = ForgedLeaf()

    with pytest.raises(ValueError, match="cannot be proved deeply immutable"):
        frozen(forged)


def test_preparation_re_derives_no_leaf_test(views, preparation):
    """F0026: the docstring's 'any caller must call this function' must be true of `frozen`.

    Both forbidden forms are checked. The `isinstance` form is not exploitable in the opening
    direction, but a control surface that is false while it stands is the finding.
    """
    import inspect

    code = [
        line.split("#", 1)[0]
        for line in inspect.getsource(preparation.frozen).splitlines()
        if not line.lstrip().startswith("#")
    ]
    executable = "\n".join(code)
    assert "type(value) in IMMUTABLE_LEAVES" not in executable
    assert "isinstance(value, IMMUTABLE_LEAVES)" not in executable
    require_c8_attr(views, "subclasses_immutable_leaf")


def test_honest_leaves_and_subclasses_are_unmoved(preparation):
    """Vacuity control: the repair must not change what `frozen` accepts or refuses."""
    frozen = require_c8_attr(preparation, "frozen")

    for leaf in (True, 7, 1.5, 2j, "text", b"raw", None):
        assert frozen(leaf) is leaf

    class SneakyStr(str):
        pass

    with pytest.raises(ValueError, match="subclasses a safe scalar"):
        frozen(SneakyStr("x"))


# --------------------------------------------------------------------------------------------
# F0024 — the two copy functions disagree on a hybrid's face
# --------------------------------------------------------------------------------------------


class HybridBytearrayMapping(bytearray, Mapping):
    """A real `bytearray` that is also a real `Mapping`, with no forgery whatsoever."""


def test_the_hybrid_really_wears_both_faces():
    """Positive control: the disagreement below is about arm order, not about a fake."""
    hybrid = HybridBytearrayMapping(b"ab")
    assert isinstance(hybrid, bytearray)
    assert isinstance(hybrid, Mapping)


def test_frozen_and_dead_copy_agree_on_the_hybrid_face(views, preparation):
    """F0024: `frozen` must take the same face `_dead_copy` takes — the `Mapping` one.

    `_dead_copy` puts the mapping cross-check ahead of every arm that would copy a value on
    another face, precisely so a two-faced container cannot skip `stored_entries`. `frozen`
    kept the buffer arm first, so it collapsed the hybrid to `bytes` before the cross-check
    could ever run on the snapshot path.
    """
    frozen = require_c8_attr(preparation, "frozen")
    proved_copy = require_c8_attr(views, "proved_copy")

    # `_dead_copy` decides the `Mapping` face first and declines to copy this value, reporting a
    # divergence instead. Agreement means `frozen` must not copy it on the *buffer* face either:
    # a hybrid collapsed to `bytes` here is a value the cross-check never judged.
    walked, _, diverged = proved_copy(
        MappingProxyType({FIELD: HybridBytearrayMapping(b"ab")}), "top"
    )
    assert type(walked[FIELD]) is not bytes, "_dead_copy copied the hybrid on its buffer face"
    assert diverged, "the unreadable mapping face must be reported"

    # F0040: the refusal no longer claims the mapping *raised*, because `read_items` also answers
    # `None` for a well-formed `.items()` that yields a non-pair, where nothing raised at all.
    # This hybrid genuinely does raise, and the widened wording still covers it.
    with pytest.raises(ValueError, match=r"would not be read as `\.items\(\)` pairs"):
        frozen(HybridBytearrayMapping(b"ab"))


def test_a_plain_bytearray_is_still_frozen_to_bytes(preparation):
    """Vacuity control: reordering must not move the ordinary `bytearray` case."""
    frozen = require_c8_attr(preparation, "frozen")
    copied = frozen(bytearray(b"payload"))
    assert type(copied) is bytes
    assert copied == b"payload"


# --------------------------------------------------------------------------------------------
# F0023 — depth exhaustion says nothing on the channel that refuses
# --------------------------------------------------------------------------------------------


def test_depth_exhaustion_keeps_the_immutability_channel_byte_identical(views):
    """F0023: `proved_copy` must report at the bound on the channel `__post_init__` reads.

    `proved_copy`'s own docstring states the immutability findings stay byte-identical to
    `immutability_findings` on the same value. At depth exhaustion they were empty while
    `immutability_findings` reported, so a projection nested past the bound reached the
    refusal check with nothing said about it.
    """
    proved_copy = require_c8_attr(views, "proved_copy")
    immutability_findings = require_c8_attr(views, "immutability_findings")
    max_depth = require_c8_attr(views, "MAX_PROJECTION_DEPTH")

    exhausted = tuple(range(max_depth))
    value = {"still": "mutable"}

    expected = immutability_findings(value, "top", exhausted)
    _, findings, diverged = proved_copy(value, "top", exhausted)

    assert expected, "the control itself must report at the bound"
    assert findings == expected, "the immutability channel is no longer byte-identical"
    assert any(str(max_depth) in finding for finding in diverged), "the depth report was lost"


def test_shallow_walks_are_unmoved_by_the_depth_repair(views):
    """Vacuity control: nothing below the bound changes."""
    proved_copy = require_c8_attr(views, "proved_copy")
    immutability_findings = require_c8_attr(views, "immutability_findings")

    value = MappingProxyType({FIELD: {"still": "mutable"}})
    _, findings, _ = proved_copy(value, "top")
    assert findings == immutability_findings(value, "top")


# --------------------------------------------------------------------------------------------
# F0022 / F0006 — hostile keys escape the seam through hashing and formatting
# --------------------------------------------------------------------------------------------


class Unhashable:
    """An announced key that refuses to be hashed."""

    __hash__ = None  # type: ignore[assignment]


class _HostileKeyMapping(Mapping):
    """Announces one key by iteration and yields a different, empty `.items()` read."""

    def __init__(self, announced, items, length=None):
        self._announced = list(announced)
        self._items = list(items)
        self._length = len(self._items) if length is None else length

    def __iter__(self):
        return iter(self._announced)

    def __len__(self):
        return self._length

    def __getitem__(self, key):
        for stored_key, value in self._items:
            if stored_key is key or stored_key == key:
                return value
        raise KeyError(key)

    def items(self):
        return list(self._items)

    def keys(self):
        return list(self._announced)


def test_an_unhashable_announced_key_does_not_escape(stored_entries):
    """F0022: the membership test hashes an attacker key outside every `try`."""
    assert Unhashable.__hash__ is None, "the control must really be unhashable"

    mapping = _HostileKeyMapping(announced=[Unhashable()], items=[])
    stored, findings = stored_entries(mapping, "top")

    assert stored == {}
    assert findings, "an unhashable announced key must be reported, not raised"


class ExplodingFormat:
    """A key whose `__format__` and `__repr__` both raise, and which hashes fine."""

    def __format__(self, spec):
        raise RuntimeError("this key refuses to be formatted")

    def __repr__(self):
        raise RuntimeError("this key refuses to be represented")

    def __hash__(self):
        return 0xC8

    def __eq__(self, other):
        return self is other


class _RefusingSubscript(Mapping):
    """Yields one entry by `.items()` whose subscript then refuses."""

    def __init__(self, key, value):
        self._key = key
        self._value = value

    def __iter__(self):
        return iter([self._key])

    def __len__(self):
        return 1

    def __getitem__(self, key):
        raise KeyError("this mapping will not answer by subscript")

    def items(self):
        return [(self._key, self._value)]


def test_the_hostile_key_really_refuses_to_be_formatted():
    """Positive control for the F0006 vector."""
    hostile = ExplodingFormat()
    with pytest.raises(RuntimeError):
        f"{hostile}"
    with pytest.raises(RuntimeError):
        repr(hostile)
    assert hash(hostile) == 0xC8


def test_a_key_that_refuses_to_be_formatted_does_not_suppress_its_finding(stored_entries):
    """F0006: the six bare `{key}` sites let a hostile key suppress its own divergence."""
    hostile = ExplodingFormat()
    mapping = _RefusingSubscript(hostile, "stored-value")

    _, findings = stored_entries(mapping, "top")

    assert findings, "the divergence must be reported, not suppressed by the key"
    assert any("unrepresentable" in finding for finding in findings)


def test_safe_repr_is_exported_for_the_unguarded_callers(views):
    """F0006: the repair must be importable, or it is re-minted in every file it did not reach."""
    safe_repr = require_c8_attr(views, "safe_repr")
    require_c8_attr(views, "safe_type_name")
    assert safe_repr(ExplodingFormat()).startswith("<unrepresentable ")
    assert safe_repr(7) == "7"


def test_preparation_reducers_survive_a_hostile_repr(preparation):
    """F0006: reducers contracted to *return* findings must not raise on a hostile input."""
    adapter_findings = require_c8_attr(preparation, "adapter_findings")
    expected_control_findings = require_c8_attr(preparation, "expected_control_findings")

    class HostileAdapters:
        def __getattr__(self, name):
            return ExplodingFormat()

    assert adapter_findings(HostileAdapters()), "a hostile surface must be refused, not raised"
    assert expected_control_findings(ExplodingFormat()), "a hostile document must be refused"


# --------------------------------------------------------------------------------------------
# F0025 — the docstring describes two reconciliations that are not performed
# --------------------------------------------------------------------------------------------


def test_a_key_announced_only_by_keys_is_reconciled(stored_entries):
    """F0025: the docstring claims `keys()` is one of the announcing views. It was never read."""
    mapping = _HostileKeyMapping(announced=[], items=[("a", 1)], length=1)
    mapping.keys = lambda: ["ghost"]  # type: ignore[method-assign]

    _, findings = stored_entries(mapping, "top")

    assert any("ghost" in finding for finding in findings), "keys() is not reconciled"


def test_duplicate_yielded_keys_are_reported(stored_entries):
    """F0025: duplicates collapse into `stored` silently, so the yielded count must be checked."""
    mapping = _HostileKeyMapping(announced=["a"], items=[("a", 1), ("a", 2)], length=1)

    stored, findings = stored_entries(mapping, "top")

    assert stored == {"a": 2}
    assert any("collapsed" in finding for finding in findings), "the duplicate was never reported"


def test_an_honest_mapping_yields_no_key_set_findings(stored_entries):
    """Vacuity control: the two new reconciliations must not fire on an honest reading."""
    stored, findings = stored_entries(MappingProxyType({"a": 1, "b": 2}), "top")
    assert stored == {"a": 1, "b": 2}
    assert findings == ()
