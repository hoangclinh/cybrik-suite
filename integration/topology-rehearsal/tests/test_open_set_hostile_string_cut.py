"""The open set's four gating rows are one mechanism: a hostile object touched outside a `try`.

Filed by `VERDICT-2066a8d` as F0006 (carried), F0035, F0036 (new, `views.py`) and F0037 (new,
`preparation.py`). They are graded separately because they name different lines, but they are one
shape, and repairing them one at a time is what has kept the P2 count at 4, 6, 8, 9 across four
verdicts. The shape is: an object that arrived through an injected port is asked to describe or
unpack itself *outside* every guard, inside a seam whose contract is to **return** findings or to
fail closed into `PrecheckAbort`. When the description raises, the seam yields a foreign exception
instead of its documented refusal, so a value suppresses the report of its own divergence.

Three distinct channels, all with the same attacker control:

* **The string channel (F0006).** `safe_repr` and `safe_type_name` already catch a raising
  `__repr__` or `__name__`. They do not catch the *return value*: `repr()` only requires a `str`,
  and a `str` **subclass** with a raising `__format__` passes both the builtin's check and the
  `isinstance(name, str)` guard. The refusal is then interpolated into an f-string by the caller,
  which is outside the helper's `try`, so the guard is bypassed by satisfying it.

* **The unpack channel (F0035).** `.items()` is read inside a `try`, but the pair unpacking that
  consumes the read is outside it. An entry that is not a two-element pair, or one whose
  `__iter__` raises, escapes `views.stored_entries`, `observe.local_presence_findings` and
  `preparation.frozen` — all three contracted never to raise that way.

* **The exception channel (F0036, F0037).** `type(error).__name__` inside `except ... as error`
  is raw at eight `views.py` sites and both `preparation` ingress guards. The raised object's
  class is attacker-chosen, so its metaclass `__name__` can refuse — and this interpolation sits
  *in the handler itself*, the outermost converter for its seam, so the replacement exception
  escapes **past** the guard rather than into it.

Anti-vacuity: every hostile fixture is proved hostile by a positive control that asserts the raw
operation really does raise, before any refusal is asserted. Without that control a repair which
merely stopped calling the operation would pass. Honest values are held to their existing
behaviour in the same tests, so a repair that made every input refuse would fail.

`{error}` is deliberately **not** swapped for `safe_repr(error)` anywhere: `str(e)` and `repr(e)`
differ, and existing suites assert message text. Only `type(error).__name__` is closed here.

Nothing here executes an entrypoint, opens a socket or touches Docker. RUNTIME stays HOLD.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pytest
from conftest import load_c8, require_c8_attr

LABEL = "label"
KEY = "present"


class RaisingFormatStr(str):
    """A real `str` that refuses to be interpolated.

    `isinstance(x, str)` is `True` and `repr()` accepts it as a return value, so it passes every
    check the helpers make today. `__format__` is what an f-string actually calls.
    """

    def __format__(self, spec: str) -> str:
        raise RuntimeError("this string refuses to be formatted")

    def __str__(self) -> str:
        raise RuntimeError("this string refuses to be rendered")


class HostileRepr:
    """`__repr__` returns a `str` subclass that will not format. The builtin permits this."""

    def __repr__(self) -> str:
        return RaisingFormatStr("<hostile>")


class HostileNameMeta(type):
    """A metaclass whose `__name__` answers a `str` that refuses to be interpolated."""

    @property
    def __name__(cls) -> str:  # type: ignore[override]
        return RaisingFormatStr("HostileName")


class HostileNamed(metaclass=HostileNameMeta):
    """An ordinary object whose *type* will not survive being named into a message."""


class HostileNamedError(Exception, metaclass=HostileNameMeta):
    """An exception whose type name is a string that refuses to be interpolated."""


class NonPairItems(Mapping):
    """A `Mapping` whose `.items()` yields something that is not a two-element pair.

    `.items()` itself does not raise, so `read_items` returns normally and the guard around it
    is satisfied. The failure lands on the unpacking that consumes the read.
    """

    def __init__(self, entry: Any) -> None:
        self._entry = entry

    def items(self):  # type: ignore[override]
        return (self._entry,)

    def keys(self):  # type: ignore[override]
        return (KEY,)

    def __getitem__(self, key: str) -> Any:
        return True

    def __iter__(self):
        return iter((KEY,))

    def __len__(self) -> int:
        return 1


# --------------------------------------------------------------------------------------------
# Positive controls: prove each fixture is actually hostile before asserting any refusal.
# --------------------------------------------------------------------------------------------


def test_control_raising_format_str_is_a_str_that_refuses_interpolation() -> None:
    """Without this, the F0006 assertions could pass against a fixture that was never hostile."""
    hostile = RaisingFormatStr("x")
    assert isinstance(hostile, str)
    assert repr(HostileRepr()) == "<hostile>"
    assert isinstance(repr(HostileRepr()), str)
    with pytest.raises(RuntimeError):
        f"{hostile}"


def test_control_hostile_metaclass_name_refuses_interpolation() -> None:
    """`type(value).__name__` returns a `str`, and interpolating that `str` raises."""
    name = type(HostileNamed()).__name__
    assert isinstance(name, str)
    with pytest.raises(RuntimeError):
        f"{name}"


def test_control_non_pair_entry_breaks_unpacking() -> None:
    """The read succeeds; only the unpacking fails. That is why the existing guard misses it."""
    mapping = NonPairItems(("a", "b", "c"))
    assert mapping.items() == (("a", "b", "c"),)
    with pytest.raises(ValueError):
        dict(mapping.items())


# --------------------------------------------------------------------------------------------
# F0006 -- the string channel: the helpers must return an exact `str`, not one a value supplied.
# --------------------------------------------------------------------------------------------


def test_safe_repr_returns_an_exact_str_that_interpolates() -> None:
    views = load_c8("views")
    safe_repr = require_c8_attr(views, "safe_repr")

    described = safe_repr(HostileRepr())

    assert type(described) is str, "a str subclass the judged value supplied is not a safe string"
    assert f"{described}" == "<hostile>"


def test_safe_type_name_returns_an_exact_str_that_interpolates() -> None:
    views = load_c8("views")
    safe_type_name = require_c8_attr(views, "safe_type_name")

    named = safe_type_name(HostileNamed())

    assert type(named) is str
    assert f"{named}" == "HostileName"


def test_safe_helpers_keep_answering_honestly_for_ordinary_values() -> None:
    """A repair that simply refused every value would pass the two tests above."""
    views = load_c8("views")
    safe_repr = require_c8_attr(views, "safe_repr")
    safe_type_name = require_c8_attr(views, "safe_type_name")

    assert safe_repr("plain") == "'plain'"
    assert safe_type_name("plain") == "str"
    assert safe_type_name(HostileRepr()) == "HostileRepr"


# --------------------------------------------------------------------------------------------
# F0035 -- the unpack channel: three seams contracted to return findings, not to raise.
# --------------------------------------------------------------------------------------------


def test_stored_entries_reports_a_non_pair_entry_instead_of_raising() -> None:
    views = load_c8("views")
    stored_entries = require_c8_attr(views, "stored_entries")

    stored, findings = stored_entries(NonPairItems(("a", "b", "c")), LABEL)

    assert stored == {}, "an entry that never unpacked must not be judged as stored"
    assert findings, "the seam must report the entry it could not read"
    assert any(LABEL in finding for finding in findings)


def test_stored_entries_reports_an_entry_whose_iteration_raises() -> None:
    views = load_c8("views")
    stored_entries = require_c8_attr(views, "stored_entries")

    class RaisingIter:
        def __iter__(self):
            raise RuntimeError("this entry refuses to be unpacked")

    stored, findings = stored_entries(NonPairItems(RaisingIter()), LABEL)

    assert stored == {}
    assert findings


def test_stored_entries_still_judges_an_honest_mapping() -> None:
    """A repair that discarded every entry would pass the two tests above."""
    views = load_c8("views")
    stored_entries = require_c8_attr(views, "stored_entries")

    stored, findings = stored_entries({KEY: True}, LABEL)

    assert stored == {KEY: True}
    assert findings == ()


def test_local_presence_findings_reports_a_non_pair_entry_instead_of_raising() -> None:
    observe = load_c8("observe")
    local_presence_findings = require_c8_attr(observe, "local_presence_findings")

    findings = local_presence_findings(NonPairItems(("a", "b", "c")), LABEL)

    assert isinstance(findings, tuple)
    assert findings, "a reading that cannot be unpacked is a refusal, not a crash"


def test_local_presence_findings_still_accepts_an_honest_reading() -> None:
    observe = load_c8("observe")
    local_presence_findings = require_c8_attr(observe, "local_presence_findings")

    assert local_presence_findings({KEY: True}, LABEL) == ()


def test_frozen_refuses_a_non_pair_entry_as_value_error() -> None:
    """`frozen` is contracted to raise `ValueError`; an unpack failure must not change that."""
    preparation = load_c8("preparation")
    frozen = require_c8_attr(preparation, "frozen")

    class RaisingIter:
        def __iter__(self):
            raise RuntimeError("this entry refuses to be unpacked")

    with pytest.raises(ValueError):
        frozen(NonPairItems(RaisingIter()))


# --------------------------------------------------------------------------------------------
# F0036 / F0037 -- the exception channel: the handler is the outermost converter for its seam.
# --------------------------------------------------------------------------------------------


def test_stored_entries_reports_a_subscript_error_that_refuses_to_be_named() -> None:
    views = load_c8("views")
    stored_entries = require_c8_attr(views, "stored_entries")

    class RefusingSubscript(Mapping):
        def items(self):  # type: ignore[override]
            return ((KEY, True),)

        def keys(self):  # type: ignore[override]
            return (KEY,)

        def __getitem__(self, key: str) -> Any:
            raise HostileNamedError("subscript refuses")

        def __iter__(self):
            return iter((KEY,))

        def __len__(self) -> int:
            return 1

    _stored, findings = stored_entries(RefusingSubscript(), LABEL)

    assert findings, "the handler must report the disagreement, not raise out of itself"
    assert any("<unnameable type>" in f or "HostileName" in f for f in findings)


def test_guarded_fails_closed_when_the_error_refuses_to_be_named() -> None:
    """`guarded` is documented to fail closed into `PrecheckAbort`, never a foreign exception."""
    preparation = load_c8("preparation")
    errors = load_c8("errors")
    guarded = require_c8_attr(preparation, "guarded")
    precheck_abort = require_c8_attr(errors, "PrecheckAbort")

    def read() -> Any:
        raise HostileNamedError("seam refuses")

    with pytest.raises(precheck_abort):
        guarded(LABEL, read)


def test_projected_fails_closed_when_the_copy_error_refuses_to_be_named() -> None:
    preparation = load_c8("preparation")
    errors = load_c8("errors")
    projected = require_c8_attr(preparation, "projected")
    precheck_abort = require_c8_attr(errors, "PrecheckAbort")

    class UncopyableRefusingName:
        def __iter__(self):
            raise HostileNamedError("copy refuses")

    def read() -> Any:
        return NonPairItems(UncopyableRefusingName())

    with pytest.raises(precheck_abort):
        projected(LABEL, read)


def test_frozen_result_field_names_a_hostile_type_without_raising_runtime_error() -> None:
    """F0037: `__post_init__` must raise the documented `ValueError`, not a naming `RuntimeError`."""
    preparation = load_c8("preparation")
    result = require_c8_attr(preparation, "PreparationResult")

    with pytest.raises(ValueError):
        result(
            satisfied=True,
            control_identities=HostileNamed(),
            image={},
            selected_image_identity={},
            docker_platform={},
            docker_executable={},
            probe_executable={},
            ephemeral_range=(),
            pre_consumption_listeners=(),
            docker_publications=(),
            granted_image_identity={},
            granted_observed_at="",
        )
