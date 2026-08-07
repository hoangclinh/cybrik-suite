"""INTENDED RED until the open-set batch lands: F0001-F0009 in `views.py`.

Every test here pins one row of the driver-injected open set. They are written as one module
because the findings are not independent: they are four mechanisms, and repairing one without
the others leaves the same seam raising through a different door.

The four mechanisms, and which rows each carries:

* **The seam must not raise.** `views` documents every reader as "raising nothing out of a seam
  whose callers are reducers contracted to return findings". Two routes break that promise:
  attacker-controlled `repr()` interpolated outside every `try` (F0006), and an `id()`-keyed
  cycle guard that a mapping rebuilding its nesting on each read defeats outright, so the walk
  recurses until CPython raises `RecursionError` (F0005).
* **Ask the interpreter, not the object.** The F153/P2-2/P1-1/P2-10 line closed four forgery
  doors by replacing membership and `isinstance` with identity and `issubclass(type(...))`.
  `:357` is *deliberately* left broad (F0008 is a false-claim finding, not a guard defect), the `bytearray` arm still precedes the `Mapping` arm so a
  hybrid is copied on its buffer face without the mapping cross-check (F0009), and the forgeable
  leaf tuple is still the exported name while the safe predicate stays private (F0002).
* **The cross-check must cover the keys it claims to.** The key set is taken from `.items()`
  alone, so a mapping whose `keys()`/`__iter__`/`__len__` answer for an entry `.items()` never
  yields is cross-checked on a set that excludes exactly the hostile entry (F0004).
* **A docstring is a control surface.** Three docstrings state contracts the code does not
  perform (F0001, F0003, F0007).
"""

from __future__ import annotations

import sys
from collections.abc import Mapping
from types import MappingProxyType

import pytest

from cybrik_suite_topology_rehearsal import views
from cybrik_suite_topology_rehearsal.views import proved_copy, stored_entries

LABEL = "probe"


# --------------------------------------------------------------------------------------
# F0006 -- a raising __repr__ escapes the seam
# --------------------------------------------------------------------------------------


class HostileRepr:
    """A value whose `repr()` raises, reached only once it is already being reported."""

    def __repr__(self) -> str:
        raise RuntimeError("repr refused")


class DivergentHostileRepr(Mapping):
    """Stores a value whose `repr()` raises and whose subscript disagrees with `.items()`.

    The divergence is what drives the reporting path; the raising `repr()` is what that
    reporting path then interpolates.
    """

    def __init__(self) -> None:
        self._stored = HostileRepr()

    def __iter__(self):
        return iter(("k",))

    def __len__(self) -> int:
        return 1

    def __getitem__(self, key):
        return HostileRepr()


def test_a_raising_repr_does_not_escape_stored_entries():
    """INTENDED RED (F0006): the finding f-strings interpolate `!r` outside every `try`."""
    _stored, findings = stored_entries(DivergentHostileRepr(), LABEL)
    assert findings, "the two views disagree, so this must be reported at all"
    assert any("k" in finding for finding in findings)


def test_a_raising_repr_does_not_escape_proved_copy():
    """GREEN since the `!r` interpolations moved inside the guards; it was the INTENDED RED that
    proved F0006 reached through the fused walk.

    The route is pinned (F0028): a bare `assert diverged` is satisfied by any divergence at all,
    including a key-set finding, so it could not tell the hostile `repr` being contained from an
    unrelated disagreement about the same object.
    """
    _, _, diverged = proved_copy(
        MappingProxyType({"outer": DivergentHostileRepr()}), "root"
    )
    assert any("k" in finding for finding in diverged), (
        "the containment of a raising `repr` must be the reported divergence, not merely some "
        "divergence on the same reading"
    )


# --------------------------------------------------------------------------------------
# F0005 -- the id()-keyed cycle guard is defeated by freshly rebuilt nesting
# --------------------------------------------------------------------------------------


class RebuildsNestingEachRead(Mapping):
    """Never returns the same object twice, so `id(value) in seen` never fires.

    This is not a cycle: it is an *infinite* projection, which the guard was written to stop
    and cannot, because it recognises repetition by object identity and this mapping supplies
    a fresh object at every level.
    """

    def __iter__(self):
        return iter(("deeper",))

    def __len__(self) -> int:
        return 1

    def __getitem__(self, key):
        return RebuildsNestingEachRead()

    def items(self):
        return ((("deeper"), RebuildsNestingEachRead()),)


def test_unbounded_rebuilt_nesting_is_reported_not_recursed():
    """GREEN since the depth bound landed; it was the INTENDED RED that proved F0005, where
    recursion was unbounded and `RecursionError` left the seam.

    The signature takes no parameter (F0027). It previously read `recursion_budget=None`, which
    pytest resolves as a fixture request rather than a default, so the name silently bound to
    nothing and pinned no budget; the bound is asserted from `diverged` below instead.
    """
    value = MappingProxyType({"top": RebuildsNestingEachRead()})
    _, findings, diverged = proved_copy(value, "root")
    assert any("nests deeper than" in finding for finding in diverged), (
        "an unbounded projection must be a finding, not a recursion"
    )
    assert not any("nests deeper than" in finding for finding in findings), (
        "depth exhaustion is a refusal, not an immutability verdict: putting it in the "
        "immutability channel would be dropped by _dead_mapping on this exact path"
    )


def test_the_depth_bound_is_below_the_interpreter_limit():
    """The bound only protects the seam if it trips before CPython's own limit does."""
    bound = getattr(views, "MAX_PROJECTION_DEPTH", None)
    assert bound is not None, "INTENDED RED (F0005): no declared depth bound exists"
    assert bound < sys.getrecursionlimit()


# --------------------------------------------------------------------------------------
# F0008 / F0010 -- the imposter's real route
# --------------------------------------------------------------------------------------


class ForgedStrClass:
    """Publishes `__class__ = str` without inheriting from it."""

    __class__ = str  # type: ignore[assignment]


def test_the_forged_str_imposter_is_refused_by_the_container_handler():
    """INTENDED RED (F0008/F0010): `:357` admits it as a `Sequence` via `__class__`.

    `_dead_copy`'s docstring claims the imposter "falls through to the uncopied return". It does
    not: `isinstance(value, (AbstractSet, Sequence))` consults `__class__`, `str` is registered
    as a `Sequence`, so the imposter enters the member walk, fails to iterate, and is returned by
    the *exception handler* with a divergence finding. The value is identical either way, which
    is why discarding the divergence tuple hid the real route for four verdicts.

    The repair is to the docstring, not the guard: narrowing the arm to `issubclass` was tried
    and reverted because `test_f131_ingress_guard` proved it lets a two-faced container reach
    `TOPOLOGY_PASS`. This test therefore pins the *actual* fail-closed route, so the claim and
    the code can never drift apart again without a RED here.
    """
    forged = ForgedStrClass()
    value, findings, diverged = proved_copy(forged, "root")
    assert value is forged
    assert any("not deeply immutable" in finding for finding in findings)
    assert any("no copy of it exists to record" in finding for finding in diverged), (
        "the imposter is admitted by the container arm and must come back as a refusal"
    )


# --------------------------------------------------------------------------------------
# F0009 -- a bytearray+Mapping hybrid is copied on its buffer face
# --------------------------------------------------------------------------------------


class ByteMappingHybrid(bytearray, Mapping):
    """A real `bytearray` subclass that is also a `Mapping` with two disagreeing views."""

    def __iter__(self):
        return iter(("k",))

    def __len__(self) -> int:
        return 1

    def __getitem__(self, key):
        if isinstance(key, str):
            return "stored"
        return bytearray.__getitem__(self, key)

    def items(self):
        return (("k", "stored"),)

    def get(self, key, default=None):
        return "a completely different answer"


def test_a_bytearray_mapping_hybrid_is_cross_checked_as_a_mapping():
    """INTENDED RED (F0009): the `bytearray` arm at `:334` wins before the `Mapping` arm."""
    hybrid = ByteMappingHybrid(b"ab")
    _, _, diverged = proved_copy(MappingProxyType({"h": hybrid}), "root")
    assert diverged, (
        "the hybrid's `.get` contradicts its `.items()`; taking the buffer face skips that"
    )


# --------------------------------------------------------------------------------------
# F0004 -- keys only the other two views answer are never compared
# --------------------------------------------------------------------------------------


class ShortItems(Mapping):
    """`.items()` yields one key; `__iter__`, `keys()` and `__len__` all claim two."""

    def __iter__(self):
        return iter(("shown", "hidden"))

    def __len__(self) -> int:
        return 2

    def __getitem__(self, key):
        return "value"

    def items(self):
        return (("shown", "value"),)


def test_a_key_only_the_other_views_answer_is_reported():
    """INTENDED RED (F0004): `stored` comes from `.items()`, so `hidden` is never compared."""
    _, findings = stored_entries(ShortItems(), LABEL)
    assert any("hidden" in finding for finding in findings)


# --------------------------------------------------------------------------------------
# F0002 -- the safe predicate must be the exported one
# --------------------------------------------------------------------------------------


def test_the_safe_leaf_predicate_is_public_and_exported():
    """INTENDED RED (F0002): only the forgeable tuple is exported today."""
    assert "is_immutable_leaf" in views.__all__
    assert callable(views.is_immutable_leaf)


def test_the_public_predicate_refuses_a_metaclass_forgery():
    """The exported predicate must carry the F153 identity discipline, not membership."""

    class LyingMeta(type):
        def __eq__(self, other):
            return True

        def __hash__(self):
            return 0

    class Forged(metaclass=LyingMeta):
        pass

    forged = Forged()
    assert type(forged) in views.IMMUTABLE_LEAVES, "the forgery must really fool membership"
    assert not views.is_immutable_leaf(forged)


# --------------------------------------------------------------------------------------
# Vacuity controls: the batch must not widen or break honest readings
# --------------------------------------------------------------------------------------


@pytest.mark.parametrize("leaf", [True, 7, 1.5, 2j, "text", b"raw", None])
def test_exact_leaves_still_return_unchanged(leaf):
    value, findings, diverged = proved_copy(leaf, "root")
    assert value is leaf
    assert findings == ()
    assert diverged == ()


def test_an_honest_nested_projection_still_clears():
    honest = MappingProxyType({"a": MappingProxyType({"b": ("x", 1)})})
    value, findings, diverged = proved_copy(honest, "root")
    assert findings == ()
    assert diverged == ()
    assert value["a"]["b"] == ("x", 1)


def test_an_honest_shallow_mapping_still_clears():
    stored, findings = stored_entries(MappingProxyType({"k": "v"}), LABEL)
    assert stored == {"k": "v"}
    assert findings == ()


# --------------------------------------------------------------------------------------
# F0032 / F0033 -- the two announcing views are reconciled once each, and both of them
#
# `_key_set_findings` reads three announcing views: `__iter__`, `keys()` and `__len__`. Two
# defects survived four verdicts each because they sit on opposite sides of the same loop:
# the union of the first two is walked without deduplication (F0032), and only the first of
# them is reconciled against a count (F0033). Both are pinned here by the exact finding text
# they produce, not by a bare truthiness assertion -- F0028 filed that shape in this very
# file, and F0027 filed a stray parameter that pytest silently read as a fixture request.
# --------------------------------------------------------------------------------------


class DoublyAnnouncedGhost(Mapping):
    """Both announcing views state `ghost`, and `.items()` never yields it.

    `__iter__` and `keys()` answer from one tuple, so the two views announce the *same key
    objects* rather than equal copies. That is the honest shape of a mapping announcing a key
    twice, and it is what the deduplication must collapse.
    """

    _KEYS = ("real", "ghost")

    def __iter__(self):
        return iter(self._KEYS)

    def keys(self):
        return self._KEYS

    def __len__(self) -> int:
        return 2

    def __getitem__(self, key):
        return "value"

    def items(self):
        return (("real", "value"),)


def test_a_key_announced_by_both_views_is_reported_once():
    """INTENDED RED (F0032): the union is walked undeduplicated, so `ghost` is filed twice."""
    _, findings = stored_entries(DoublyAnnouncedGhost(), LABEL)
    ghost_findings = [finding for finding in findings if "ghost" in finding]
    assert len(ghost_findings) == 1, (
        "a key announced by both `__iter__` and `keys()` must produce one finding, not one "
        f"per announcing view; got {len(ghost_findings)}: {ghost_findings}"
    )


class KeysOmitsAStoredEntry(Mapping):
    """`.items()` and `__iter__` state two entries while `keys()` states only one.

    Every key `keys()` returns *is* stored, so the unstored-key loop clears it completely: the
    entry is missing from the announcement rather than absent from the store, which is the
    direction only a count can see.
    """

    def __iter__(self):
        return iter(("a", "b"))

    def keys(self):
        return ("a",)

    def __len__(self) -> int:
        return 2

    def __getitem__(self, key):
        return "value"

    def items(self):
        return (("a", "value"), ("b", "value"))


def test_a_keys_call_that_omits_a_stored_entry_is_reported():
    """INTENDED RED (F0033): `len(claimed)` is reconciled against nothing at all."""
    _, findings = stored_entries(KeysOmitsAStoredEntry(), LABEL)
    assert any("`keys()` states 1" in finding for finding in findings), (
        "a `keys()` under-reporting a stored entry must be reported against the entry count; "
        f"got {findings}"
    )


def test_a_mapping_that_refuses_keys_is_not_also_charged_with_a_count():
    """The `keys()` refusal path must file its own finding and no count finding on top of it.

    `_claimed_keys` returns `None` and the caller substitutes `()`. An unguarded count check
    would then read that empty substitute as an under-report and file a second, misleading
    finding against a mapping whose only defect is that it would not answer `keys()`.
    """

    class RefusesKeys(Mapping):
        def __iter__(self):
            return iter(("a",))

        def keys(self):
            raise RuntimeError("no keys for you")

        def __len__(self) -> int:
            return 1

        def __getitem__(self, key):
            return "value"

        def items(self):
            return (("a", "value"),)

    _, findings = stored_entries(RefusesKeys(), LABEL)
    refusals = [finding for finding in findings if "asked for `keys()`" in finding]
    counts = [finding for finding in findings if "`keys()` states" in finding]
    assert len(refusals) == 1, f"the refusal itself must be filed once; got {findings}"
    assert counts == [], f"a refusing mapping must not also be charged a count; got {counts}"
