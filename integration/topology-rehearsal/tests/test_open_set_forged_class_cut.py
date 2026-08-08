"""The F0006 repair re-opened the `__class__`-forgery defect this codebase already closed.

Filed by `VERDICT-ede0381` as **F0039 (P1)** — a regression the previous cut shipped — together
with the carried **F0035 (P2)**, narrowed by that verdict to the *key* channel, and the two P3s
born with them, **F0040** (a refusal message that is now false for its commonest case) and
**F0041** (a hostile-named error the suite silently stopped driving through `projected`).

**F0039 — the mechanism, exactly.** `safe_type_name` closed the string channel by returning
through the unbound `str.__str__` slot, guarded by `isinstance(name, str)`. Both operations sit
*outside* the function's `try`. `isinstance` consults the instance's `__class__`, so an object
publishing `__class__ = str` satisfies the guard; `str.__str__` then asks the interpreter, which
rejects it and raises `TypeError` straight out of the one helper in this package contracted never
to raise. The guard and the operation disagree about who they ask, and the gap between them is the
defect. `views.py` documents this exact forgery at `_dead_copy`, and commit `af0d227` already
landed the lesson here — *ask the interpreter, not the object*. The instrument is established
locally: `subclasses_immutable_leaf` uses `issubclass(type(value), ...)` for this reason.

The repair is that instrument, not a new one: `issubclass(type(name), str)` resolves to
`PyType_IsSubtype` on two ordinary types, so a forged `__class__` cannot reach it, and a value it
admits is genuinely a `str` — which makes `str.__str__` total rather than merely guarded. An
honest `str` subclass keeps naming normally, so the repair is not a blanket refusal.

**F0035 — what is actually left.** `read_items` materialises its pairs *inside* its own `try`, so
the pair-unpack finding is discharged at every caller: what `entries` holds is already a tuple of
two-element tuples. What remained outside a guard is the **key**: `observe` compares each key with
`==` and stores it in a dict, and `preparation.frozen` uses `frozen(k)` as a dict key. A mapping
whose key is itself a mapping makes `frozen(k)` a `MappingProxyType`, which is unhashable, so
`frozen` raises `TypeError` out of a function contracted to raise `ValueError`. That is a real
escape reached by an ordinary nested mapping, not an exotic fixture.

Anti-vacuity: every hostile fixture carries a positive control asserting the raw operation really
does raise before any refusal is asserted, and every honest value is held to its existing naming,
so neither "stop calling it" nor "refuse everything" can pass these tests.

Nothing here executes an entrypoint, opens a socket or touches Docker. RUNTIME stays HOLD.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Any

import pytest
from conftest import load_c8, require_c8_attr

LABEL = "label"


class ForgedStrClass:
    """Not a `str`, but `isinstance(x, str)` answers `True`.

    The forgery is `__class__` alone. Nothing else about this object is a `str`, so any operation
    that asks the *interpreter* rather than the object rejects it.
    """

    __class__ = str

    def __str__(self) -> str:  # pragma: no cover -- reached only if the slot is bypassed
        return "forged"


class ForgedNameMeta(type):
    """A metaclass whose `__name__` yields the forged object instead of a real `str`."""

    @property
    def __name__(cls) -> Any:  # type: ignore[override]
        return ForgedStrClass()


class ForgedNameType(metaclass=ForgedNameMeta):
    """An instance of this names itself with something only pretending to be a `str`."""


class YieldingMapping(Mapping):
    """A `Mapping` that yields exactly the pairs it was given, without hashing them.

    A hostile key cannot be delivered through a dict literal, because the literal would hash it in
    the test rather than inside the seam under test. An injected port delivers keys through
    `.items()`, so the fixture must too.
    """

    def __init__(self, pairs: tuple[tuple[Any, Any], ...]) -> None:
        self._pairs = pairs

    def items(self) -> Any:  # type: ignore[override]
        return list(self._pairs)

    def __iter__(self) -> Any:
        return iter(pair[0] for pair in self._pairs)

    def __len__(self) -> int:
        return len(self._pairs)

    def __getitem__(self, key: Any) -> Any:
        raise KeyError(key)


class HonestSubStr(str):
    """A genuine `str` subclass, which must keep naming normally after the repair."""


class HonestSubNameMeta(type):
    @property
    def __name__(cls) -> Any:  # type: ignore[override]
        return HonestSubStr("honest_subclass_name")


class HonestSubNameType(metaclass=HonestSubNameMeta):
    """A type whose `__name__` is a real `str` subclass — an honest value, not an attack."""


def test_forged_class_str_really_defeats_the_isinstance_guard() -> None:
    """Positive control: the fixture is hostile, and the raw pairing really does raise.

    Without this, a repair that simply stopped calling `str.__str__` would pass the test below
    while leaving the guard asking the object.
    """
    forged = ForgedStrClass()
    assert isinstance(forged, str) is True, "fixture must satisfy the isinstance guard"
    assert issubclass(type(forged), str) is False, "the interpreter must reject it"
    with pytest.raises(TypeError):
        str.__str__(forged)


def test_safe_type_name_returns_the_placeholder_for_a_forged_class_name() -> None:
    """F0039: the helper contracted never to raise must not raise on a forged `__class__`."""
    module = load_c8("views")
    safe_type_name = require_c8_attr(module, "safe_type_name")

    named = safe_type_name(ForgedNameType())

    assert named == "<unnameable type>"


def test_safe_type_name_still_names_an_honest_str_subclass() -> None:
    """Anti-vacuity: the repair must not turn every name into a refusal."""
    module = load_c8("views")
    safe_type_name = require_c8_attr(module, "safe_type_name")

    assert safe_type_name(HonestSubNameType()) == "honest_subclass_name"
    assert safe_type_name(object()) == "object"
    assert safe_type_name(1) == "int"


def test_safe_repr_survives_a_forged_class_name_on_the_refusal_path() -> None:
    """`safe_repr`'s refusal path names the value through `safe_type_name`.

    So the F0039 escape is reachable through `safe_repr` too: a value whose `__repr__` refuses
    *and* whose type forges its name drove the `TypeError` out of the refusal itself.
    """
    module = load_c8("views")
    safe_repr = require_c8_attr(module, "safe_repr")

    class RefusingRepr(metaclass=ForgedNameMeta):
        def __repr__(self) -> str:
            raise ValueError("repr refuses")

    assert safe_repr(RefusingRepr()) == "<unrepresentable <unnameable type>>"


def test_frozen_refuses_a_mapping_valued_key_as_a_stated_value_error() -> None:
    """F0035, key channel: `frozen(k)` as a dict key must not escape as `TypeError`.

    A mapping whose key is itself a mapping makes `frozen(k)` a `MappingProxyType`, which is
    unhashable. `frozen` is contracted to raise `ValueError`; before the repair it raised
    `TypeError` from the dict construction, which its callers do not name.
    """
    module = load_c8("preparation")
    frozen = require_c8_attr(module, "frozen")

    # The pair cannot be written as a dict literal: that would hash the key in this test rather
    # than inside the seam. It has to arrive the way an injected port delivers it — through
    # `.items()` — which is exactly the provenance the finding is about.
    hostile = YieldingMapping(((MappingProxyType({"inner": 1}), "value"),))

    with pytest.raises(ValueError) as caught:
        frozen(hostile)

    assert "key" in str(caught.value)


def test_frozen_still_copies_an_ordinary_nested_mapping() -> None:
    """Anti-vacuity: ordinary nested mappings must still be provable."""
    module = load_c8("preparation")
    frozen = require_c8_attr(module, "frozen")

    copied = frozen({"outer": {"inner": 1}})

    assert copied == MappingProxyType({"outer": MappingProxyType({"inner": 1})})


def test_local_presence_findings_refuses_a_key_that_will_not_be_compared() -> None:
    """F0035, key channel at `observe`: a hostile key `==` / `__hash__` must become a finding.

    The reducer is contracted to *return* findings. A key whose comparison or hashing refuses was
    touched outside every guard while building the stored view.
    """
    module = load_c8("observe")
    local_presence_findings = require_c8_attr(module, "local_presence_findings")

    class RefusingKey:
        def __eq__(self, other: object) -> bool:
            raise RuntimeError("this key refuses to be compared")

        def __hash__(self) -> int:
            raise RuntimeError("this key refuses to be hashed")

    findings = local_presence_findings(YieldingMapping(((RefusingKey(), True),)), LABEL)

    assert findings, "a refusing key must be reported, not raised"
    assert any(LABEL in finding for finding in findings)


def test_read_items_refusal_message_covers_a_non_pair_yield() -> None:
    """F0040: the refusal said the mapping *raised*, which is false for the commonest case.

    A well-formed `.items()` that yields a non-pair makes `read_items` answer `None` without the
    mapping ever raising, so a message asserting that it raised misdescribes the seam.
    """
    views = load_c8("views")
    read_items = require_c8_attr(views, "read_items")

    class NonPairItems(dict):
        def items(self) -> Any:  # type: ignore[override]
            return [("only-one-element",)]

    assert read_items(NonPairItems()) is None

    preparation = load_c8("preparation")
    frozen = require_c8_attr(preparation, "frozen")
    with pytest.raises(ValueError) as caught:
        frozen(NonPairItems())
    assert "raised when read by" not in str(caught.value), (
        "the refusal must not claim the mapping raised when it did not"
    )
