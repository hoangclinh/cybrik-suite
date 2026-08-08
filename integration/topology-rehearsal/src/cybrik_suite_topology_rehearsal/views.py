"""Mapping-view reconciliation: walk a projection, prove it immutable, judge its two views.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Every function here is total and pure. Each is handed one value and answers about that value
only: it reaches nothing, holds nothing between calls and raises nothing out of a seam whose
callers are reducers contracted to return findings.

These are the machinery `observe` and `preparation` share for reading a mapping that arrived
through an injected port. Four were authored in `observe` and are held here so that module stays
inside its reviewed size bound; `observe` re-imports them, so every name still resolves there,
and nothing about that code moved with them. `proved_copy` is the one judgement authored here:
it fuses the walk, the reconciliation and the copy into one read, so what is judged and what is
recorded cannot differ.

They all turn on one property: a mapping has two views of itself — what its iteration yields
and what its subscript returns — and a projection is trustworthy only where those agree.
`MappingProxyType` over a `dict` *subclass* is exactly a `MappingProxyType` by `type()`, so it
passes every read-only-mapping gate and the immutability proof while overloading `__getitem__`.
A reader consulting one view while a consumer records the other is the hole these reconcile.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from collections.abc import Set as AbstractSet
from types import MappingProxyType
from typing import Any

__all__ = [
    "IMMUTABLE_LEAVES",
    "MAX_PROJECTION_DEPTH",
    "immutability_findings",
    "is_immutable_leaf",
    "nested",
    "proved_copy",
    "read_items",
    "safe_repr",
    "safe_type_name",
    "stored_entries",
    "subclasses_immutable_leaf",
]

# How deep a projection may nest before the walk stops and reports it. One recursion per level,
# so this stays well below the interpreter's own limit: a `RecursionError` is not a finding.
MAX_PROJECTION_DEPTH = 64


def nested(value: object, path: Sequence[str]) -> Any:
    """Walk a projection by exact key, yielding `None` at the first key that is not there.

    A projection arrives through an injected port, so every step is checked rather than
    assumed: an absent or wrong-typed level is an unresolved reading, not an exception.
    """
    current: Any = value
    for key in path:
        if not isinstance(current, Mapping):
            return None
        current = current.get(key)
    return current


# Safe immutable leaves; every other type is a container to walk or a value to report.
IMMUTABLE_LEAVES = (bool, int, float, complex, str, bytes, type(None))


def is_immutable_leaf(value: object) -> bool:
    """Whether `value`'s type is *exactly* one of the builtin leaves, decided by identity.

    This is the exported name, and `IMMUTABLE_LEAVES` is exported only so a caller can state
    *which* types those are. Reaching for the tuple to make the decision is the F153 defect
    itself: `type(value) in IMMUTABLE_LEAVES` and `isinstance(value, IMMUTABLE_LEAVES)` are both
    forgeable, the first through a metaclass `__eq__` and the second through `__class__`. Any
    caller deciding leaf status must call this function instead of re-deriving the test, and a
    caller asking the *subclass* question must call `subclasses_immutable_leaf`. Both live here
    so the decision has one definition: a guard re-derived at each call site is only as strong
    as its weakest copy, and `preparation.frozen` re-derived both forms for four verdicts while
    this sentence claimed otherwise (F0026).

    `type(value) in IMMUTABLE_LEAVES` was **not** this test, and that was F153: membership is
    `any(e is x or e == x)`, so a metaclass `__eq__` answering `True` was admitted as a builtin
    leaf, skipping both walks and reaching a fallback safe only for real leaves. Identity cannot
    be forged, and nothing widens — a leaf subclass without a lying metaclass was already
    excluded (`MySubclass == int` is `False`).
    """
    return any(leaf is type(value) for leaf in IMMUTABLE_LEAVES)


def subclasses_immutable_leaf(value: object) -> bool:
    """Whether `value` inherits from a builtin leaf without being one exactly.

    The companion to `is_immutable_leaf`, and the *only* sanctioned spelling of the subclass
    question. `preparation.frozen` refuses such a value rather than walking it: `str` and `bytes`
    are `Sequence`s, and a subclass reaching generic container handling would be taken apart into
    its own characters while the caller kept a live handle on its mutable state.

    Decided by `issubclass(type(value), ...)` rather than `isinstance`, for the reason
    `VERDICT-6d20929` filed as P2-2: `isinstance` falls back to the instance's `__class__`, so an
    unrelated object publishing `__class__ = str` was admitted here. Both operands are ordinary
    types, so the check resolves to `PyType_IsSubtype` — the interpreter's relation. Forging in
    the *opening* direction is a spurious refusal and fail-closed; the exposure is a caller
    re-deriving the test.
    """
    return issubclass(type(value), IMMUTABLE_LEAVES) and not is_immutable_leaf(value)


def safe_repr(value: object) -> str:
    """`repr(value)` as an exact `str`, or a stated placeholder when the value refuses.

    Every finding interpolates a value from an injected port, so `repr` is attacker-controlled: a
    raising `__repr__` turned the *report* of a divergence into an exception leaving a seam
    contracted to return findings. Catching the raise is not enough, since `isinstance` accepts a
    `str` *subclass* whose `__format__` refuses outside this `try`; both helpers return through
    the unbound `str.__str__` slot, which yields an exact copy (F0006)."""
    try:
        return str.__str__(repr(value))
    except (KeyboardInterrupt, SystemExit):
        raise
    except BaseException:  # noqa: BLE001 -- a value that will not be printed is still reported
        return f"<unrepresentable {safe_type_name(value)}>"


def safe_type_name(value: object) -> str:
    """`type(value).__name__`; `issubclass(type(name), str)` since `__class__` forged it (F0039)."""
    try:
        name = type(value).__name__
    except (KeyboardInterrupt, SystemExit):
        raise
    except BaseException:  # noqa: BLE001 -- a type that will not be named is still reported
        return "<unnameable type>"
    return str.__str__(name) if issubclass(type(name), str) else "<unnameable type>"


def immutability_findings(
    value: object, path: str, seen: tuple[int, ...] = ()
) -> tuple[str, ...]:
    """Report every nested value that is not already deeply immutable.

    Total and pure like the readers around it: it is handed one value and answers about that
    value only, reaching nothing and raising nothing. A cycle is reported at the path where it
    closes rather than followed, so an unbounded projection is a finding, not a recursion.
    """
    if is_immutable_leaf(value):
        return ()
    if id(value) in seen:
        return (f"{path} refers to itself",)
    if len(seen) >= MAX_PROJECTION_DEPTH:
        return (f"{path} is nested deeper than {MAX_PROJECTION_DEPTH} levels",)
    trail = (*seen, id(value))
    if type(value) is MappingProxyType:
        return tuple(
            finding
            for key, item in value.items()
            for finding in (
                *immutability_findings(key, f"{path}.<key>", trail),
                *immutability_findings(item, f"{path}.<value>", trail),
            )
        )
    if type(value) is tuple:
        return tuple(
            finding
            for item in value
            for finding in immutability_findings(item, f"{path}.<item>", trail)
        )
    if type(value) is frozenset:
        return tuple(
            finding
            for item in value
            for finding in immutability_findings(item, f"{path}.<member>", trail)
        )
    return (f"{path} holds a {safe_type_name(value)}, which is not deeply immutable",)


def _states_the_same_value(stored: object, other: object) -> bool:
    """Whether a second view's answer is the value the one `.items()` read stored.

    Identity is the fast path; a mapping that rebuilds its values on each read states the same
    value through both views and is honest, so refusing it outright was a defect.

    Agreement is never decided by an `__eq__` the judged object defines. Demanding the same type
    and a literal `True` in both directions does not defeat a lying comparison, because every
    term of that conjunction is supplied by the hostile reading itself — that was F135, and it
    cleared a real divergence to `TOPOLOGY_PASS`. Equality is consulted only where the comparison
    belongs to the interpreter: the exact builtin leaves, whose leaf status `is_immutable_leaf`
    decides by *identity*, since membership consults an `__eq__` a metaclass owns (F153). Every
    other value must be the *same object* through both views.

    The strictness is **decided, not pending** (`VERDICT-e311f8b` filed the wording that shipped
    it live while calling it open). A mapping rebuilding a non-leaf value on each read is refused,
    because it cannot be told from a two-faced one without asking the object to grade itself; the
    honest case this fallback was written for rebuilds `str`, a leaf, and is still accepted.
    Widening to structural recursion would be a new change carrying its own evidence. The full
    F135 and F153 incident narratives are in `docs/REVIEW-LEDGER.md`, which governs provenance.

    **This function does not raise; `stored_entries`' two comparison handlers are belts, not
    live routes.** `is` and `type()` are interpreter operations, the leaf guard decides by
    identity, and the only `==` compares two operands of the *same exact* scalar builtin, whose
    comparison the interpreter owns. An earlier wording promised a raise "propagates to the
    caller as a refusal" while nothing could reach it; that was F0014, and the promise is
    withdrawn rather than made true, since making it true means admitting a comparison the judged
    object owns. The handlers stay because adding a *container* leaf would make `==` recurse into
    supplied elements and reach them in the same commit.
    """
    if other is stored:
        return True
    if type(other) is not type(stored):
        return False
    if is_immutable_leaf(stored):
        return (other == stored) is True and (stored == other) is True
    return False


def _announced_keys(mapping: Mapping[str, Any]) -> tuple[Any, ...] | None:
    """Every key the mapping states through iteration, or `None` if it will not be iterated."""
    try:
        return tuple(iter(mapping))
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception:  # noqa: BLE001 -- an unreadable announcement is handled by the caller
        return None


def read_items(mapping: Mapping[Any, Any]) -> tuple[tuple[Any, Any], ...] | None:
    """One `.items()` read, or `None` if the mapping will not answer it.

    The shared spelling of "hold the read to answering". `preparation.frozen` rebuilt a mapping
    straight out of `value.items()`, so a mapping that raised mid-read — a `bytearray`+`Mapping`
    hybrid raises `IndexError` out of `_collections_abc` — escaped as a type that function's
    callers do not name, out of one contracted to raise `ValueError` (F0024).
    """
    try:
        return tuple((key, item) for key, item in mapping.items())
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception:  # noqa: BLE001 -- a mapping that will not be read is refused by the caller
        return None


def _claimed_keys(mapping: Mapping[str, Any]) -> tuple[Any, ...] | None:
    """Every key the mapping states through `keys()`, or `None` if it will not answer.

    A second announcing view, and a distinct one: `keys()` is an ordinary method a mapping is
    free to answer differently from `__iter__`, and a validator reaching for it would meet the
    entries this cross-check never saw.
    """
    try:
        return tuple(mapping.keys())
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception:  # noqa: BLE001 -- an unreadable announcement is handled by the caller
        return None


def _is_stored(key: Any, stored: dict[str, Any]) -> bool | None:
    """Whether `key` is a key of `stored`, or `None` if the key refuses to be hashed.

    Membership hashes the key, and the key arrived through an injected port. `__hash__` is
    attacker-controlled code — and an unhashable key needs no code at all, since `__hash__ =
    None` is enough — so `key not in stored` raised `TypeError` out of a seam contracted to
    return findings (F0022). That row also called this "the one place a hostile key was touched
    before any handler existed", which was false: `stored_entries` hashes every key `.items()`
    yields as it stores it, strictly before this runs. F0031 filed the lie. Both sites are
    guarded now — this one for announced keys, the storing loop for yielded ones. A key that
    will not be hashed cannot be shown to be stored: a finding, not an exception.
    """
    try:
        return key in stored
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception:  # noqa: BLE001 -- a key that will not be hashed is reported below
        return None


def _key_set_findings(
    mapping: Mapping[str, Any], stored: dict[str, Any], label: str, yielded: int
) -> tuple[str, ...]:
    """Whether the keys a mapping announces are the keys it stored under one `.items()` read.

    `stored` is one read's answer and `yielded` is how many pairs that read produced. A mapping
    whose `__iter__`, `keys()` or `__len__` answers for an entry that read never yielded has a
    view no part of this cross-check would otherwise reach, and `.get`/`__getitem__` are exactly
    where a later validator would meet it.

    All three announcing views are read, and reading only `__iter__` was F0025: `keys()` is a
    distinct method a mapping may answer differently, and `stored_entries`' docstring claimed it
    was reconciled while nothing consulted it. The count `.items()` *yielded* is checked as well
    as the count it *stored*, because duplicate keys collapse into `stored` silently — two
    entries in, one entry judged, and the loser never seen by anything (F0015).
    """
    findings: list[str] = []
    announced = _announced_keys(mapping)
    if announced is None:
        return (
            (
                f"{label}: this mapping raised when it was asked to state its keys by "
                "iteration, so the entries it stores cannot be shown to be the entries it "
                "announces"
            ),
        )
    claimed = _claimed_keys(mapping)
    claimed_answered = claimed is not None
    if claimed is None:
        findings.append(
            f"{label}: this mapping raised when it was asked for `keys()`, so the entries it "
            "stores cannot be shown to be the entries it announces"
        )
        claimed = ()
    unstored: list[Any] = []
    # One entry announced by both views is not two entries (F0032). Deduplication is keyed by
    # `id()` and must never be keyed by the key: `__hash__` is attacker-controlled here, so a
    # set of keys reintroduces the `TypeError` `_is_stored` exists to guard. Equal-but-distinct
    # keys are two objects and are judged twice; over-reporting is the fail-closed direction.
    seen_ids: set[int] = set()
    for key in (*announced, *claimed):
        if id(key) in seen_ids:
            continue
        seen_ids.add(id(key))
        is_stored = _is_stored(key, stored)
        if is_stored is None:
            findings.append(
                f"{label}: {safe_repr(key)} is announced as a key but refuses to be hashed, so "
                "it cannot be shown to be one of the entries this cross-check judges"
            )
            unstored.append(key)
            continue
        if not is_stored:
            unstored.append(key)
            findings.append(
                f"{label}: {safe_repr(key)} is announced by iteration or `keys()` but was never "
                "yielded by `.items()`, "
                "so this entry is answered by the accessors validators read while being absent "
                "from the one read this cross-check judges"
            )
    if len(announced) != len(stored) and not unstored:
        findings.append(
            f"{label}: iteration announces {len(announced)} keys while `.items()` yielded "
            f"{len(stored)} distinct entries, so at least one key collapsed silently"
        )
    if claimed_answered and len(claimed) != len(stored) and not unstored:
        findings.append(
            f"{label}: `keys()` states {len(claimed)} keys while `.items()` yielded "
            f"{len(stored)} distinct entries, so its two announcing views do not answer for "
            "the same entries"
        )
    if yielded != len(stored):
        findings.append(
            f"{label}: `.items()` yielded {yielded} pairs but only {len(stored)} distinct "
            "entries, so at least one key was yielded twice and collapsed silently"
        )
    try:
        declared_length = len(mapping)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- a mapping that will not be sized is refused
        findings.append(
            f"{label}: this mapping raised {safe_type_name(error)} when it was asked its "
            "length, so the size of the reading being judged cannot be established"
        )
        return tuple(findings)
    if declared_length != len(stored):
        findings.append(
            f"{label}: this mapping states a length of {declared_length} while `.items()` "
            f"yielded {len(stored)} distinct entries, so its views of its own size disagree"
        )
    return tuple(findings)


def stored_entries(
    mapping: Mapping[str, Any], label: str
) -> tuple[dict[str, Any], tuple[str, ...]]:
    """What a mapping *stores*, and every entry whose subscript or `.get` disagrees with it.

    The same shape of hole `local_presence_findings` closed, written once for a whole inventory
    instead of one field. A mapping is validated here by iterating it — `keyed` iterates and
    `preparation.frozen` rebuilds from `.items()` — so a judgement reading values back through
    `__getitem__` judges something no consumer records.

    A recorded value carries what `.items()` yielded only where the recording is built from that
    same read. That used to be `prepare`'s ingress alone, by a *separate* read: a
    `PreparationResult` built directly or copied by `dataclasses.replace` kept the caller's own
    mapping as its field, so the recording was no copy at all. `proved_copy` binds the two on
    every path — it hands back the `stored` dict this function already read.

    The subscript is kept as a cross-check rather than dropped, because `__getitem__` is a
    live protocol on these mappings elsewhere in the package — `runner._selected_identity`
    and `grant`'s own reductions read `mapping[key]`. A disagreement in either direction is a
    refusal, so the two views cannot diverge whichever one a later reader happens to use.

    A subscript that refuses to answer at all is a disagreement too, not an exception: passing
    `keyed` does not make a mapping subscriptable, and the callers here are reducers contracted
    to return findings and a `__post_init__` documented to raise `ValueError`.

    `.get` is cross-checked for the same reason and is the *primary* accessor, not a lesser one:
    `observe.validate_internal_network`, `validate_publication`'s reducers and `nested` all read
    live projections through it. Cross-checking iteration against the subscript alone therefore
    proved agreement between two views no validator consults, while the one they all consult was
    free to differ — a reading hostile only to `.get` cleared the cross-check and was copied on
    its stored face, so the receipt attested an isolation the live object denied. A third
    accessor is a third view of one entry, and disagreement in any of them is a refusal.

    Agreement is decided by `_states_the_same_value`. F135 refuted the bidirectional-equality
    fallback this docstring once advertised — every term of that conjunction is supplied by the
    hostile reading itself — so it is no longer reached for anything but an exact builtin leaf,
    whose comparison belongs to the interpreter. For every other value agreement means the *same
    object* through all three views. `VERDICT-e311f8b` filed the stale wording as its own
    finding. See `_states_the_same_value` for the decided strictness.

    The cross-checked key set is **not** taken from `.items()` alone. A mapping may announce keys
    through `__iter__`, `keys()` and `__len__` that its `.items()` never yields, and those are
    precisely the entries a `.get`-based validator would read while this cross-check looked away.
    Every key announced by `__iter__` *or* `keys()` is reconciled against the keys actually
    stored, and one announced but never yielded is a refusal. Reading `__iter__` alone was F0025:
    this paragraph claimed `keys()` was reconciled while `_announced_keys` consulted iteration
    only. `__len__` is cross-checked separately, below.

    Duplicate keys yielded by `.items()` collapse into `stored` silently — two pairs in, one
    entry judged — so the count `.items()` *yielded* is checked against the count it *stored*,
    not merely the announced count against the stored count. That check did not exist while this
    paragraph claimed it did (F0025, F0015), and the two counts it did compare could not see a
    duplicate at all, because collapsing leaves both sides equal.

    Nothing hostile is touched outside a `try`. Values are printed through `safe_repr` and types
    named through `safe_type_name`, because `repr`, `__format__` and `__name__` are all
    attacker-controlled and a value that refuses to be described must not suppress the report of
    its own divergence (F0006, F0030). Membership goes through `_is_stored` (F0022). The one
    `.items()` read is guarded, and the key is hashed inside a `try` as it is stored, since that
    hash runs before `_is_stored` is ever reached (F0031). The pair unpacking is inside that same
    `try`, since `.items()` returning does not make what it yielded a pair (F0035).
    """
    try:
        entries = tuple((key, item) for key, item in mapping.items())
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- a mapping that will not be read is refused
        refusal = (f"{label}: this mapping raised {safe_type_name(error)} when it was read as "
                   "`.items()` pairs, so there is no reading of it to judge")
        return {}, (refusal,)
    yielded = 0
    stored: dict[str, Any] = {}
    findings: list[str] = []
    for entry_key, entry_value in entries:
        try:
            stored[entry_key] = entry_value
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception:  # noqa: BLE001 -- a key that will not be hashed is reported below
            findings.append(
                f"{label}: {safe_repr(entry_key)} was yielded by `.items()` but refuses to be "
                "hashed, so this entry cannot be shown to be one this cross-check judges"
            )
            continue
        yielded += 1
    findings.extend(_key_set_findings(mapping, stored, label, yielded))
    for key, value in stored.items():
        try:
            subscripted = mapping[key]
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a mapping that will not answer is refused
            findings.append(
                f"{label}: {safe_repr(key)} raised {safe_type_name(error)} when read by subscript while "
                f"this mapping stores {safe_repr(value)}, so its two views of one entry disagree"
            )
            continue
        try:
            agreed = _states_the_same_value(value, subscripted)
        except (KeyboardInterrupt, SystemExit):
            raise
        # Unreachable belt: `_states_the_same_value` is total. See its docstring (F0014).
        except Exception as error:  # noqa: BLE001 -- a value that will not compare is refused
            findings.append(
                f"{label}: {safe_repr(key)} raised {safe_type_name(error)} when the object its subscript "
                f"returned was compared with the {safe_repr(value)} this mapping stores, so its two "
                "views of one entry cannot be shown to agree"
            )
            continue
        if not agreed:
            findings.append(
                f"{label}: {safe_repr(key)} reads by subscript as the {safe_type_name(subscripted)} "
                f"{safe_repr(subscripted)} while this mapping stores the "
                f"{safe_type_name(value)} {safe_repr(value)}, which are distinct objects "
                "that do not compare exactly equal in "
                "both directions, so its two views of one entry disagree"
            )
            continue
        try:
            fetched = mapping.get(key)
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a mapping that will not answer is refused
            findings.append(
                f"{label}: {safe_repr(key)} raised {safe_type_name(error)} when read by `.get` while this "
                f"mapping stores {safe_repr(value)}, so its two views of one entry disagree"
            )
            continue
        try:
            agreed = _states_the_same_value(value, fetched)
        except (KeyboardInterrupt, SystemExit):
            raise
        # Unreachable belt, on the same terms as the subscript comparison above (F0014).
        except Exception as error:  # noqa: BLE001 -- a value that will not compare is refused
            findings.append(
                f"{label}: {safe_repr(key)} raised {safe_type_name(error)} when the object its `.get` "
                f"returned was compared with the {safe_repr(value)} this mapping stores, so its two "
                "views of one entry cannot be shown to agree"
            )
            continue
        if not agreed:
            findings.append(
                f"{label}: {safe_repr(key)} reads by `.get` as the {safe_type_name(fetched)} "
                f"{safe_repr(fetched)} while this mapping stores the "
                f"{safe_type_name(value)} {safe_repr(value)}, which are distinct objects "
                "that do not compare exactly equal in "
                "both directions, so its two views of one entry disagree"
            )
    return stored, tuple(findings)


def _proved_members(
    items: Any, path: str, trail: tuple[int, ...], build: Any
) -> tuple[Any, tuple[str, ...], tuple[str, ...]]:
    """Copy one flat container's members through `proved_copy`, keeping finding order."""
    copied: list[Any] = []
    nested_findings: list[str] = []
    diverged: list[str] = []
    for item in items:
        member, member_nested, member_diverged = proved_copy(item, path, trail)
        copied.append(member)
        nested_findings.extend(member_nested)
        diverged.extend(member_diverged)
    return build(copied), tuple(nested_findings), tuple(diverged)


def _dead_copy(
    value: Any, path: str, trail: tuple[int, ...]
) -> tuple[Any, tuple[str, ...]]:
    """A dead copy of a value already reported, and every divergence found below it.

    The verdict on `value` is settled before this is called: it is not deeply immutable, and
    `proved_copy` reports exactly that one finding, byte-identical to `immutability_findings`.
    What is *not* settled is whether the value the caller still owns is the value that gets
    recorded. `preparation.frozen` rebuilds every `bytearray`, `Mapping`, `AbstractSet` and
    `Sequence` from its own fresh read, so a value handed back uncopied here is read live a
    second time on the copy path, and a two-faced mapping nested below the top is never
    cross-checked at all. This copies and cross-checks every type `frozen` rebuilds.

    It is **not** aligned with `frozen` on scalar subclasses, and saying it was is what
    `VERDICT-a703a45` filed P1-1 against. `preparation.frozen` *refuses* a subclass of a safe
    scalar outright (`preparation.py:133-141`); this function accepts one and copies it. The two
    are opposites at exactly that boundary, deliberately: this phase reports what it cannot prove
    and leaves refusing to `PreparationResult.__post_init__`, so raising here would move the
    verdict rather than copy a value.

    It reports nothing further about immutability, and that is deliberate. Widening the
    *verdict* to match this walk would make a nested plain `dict` proved rather than reported,
    and `PreparationResult.__post_init__` refuses on exactly that finding today — a control
    would have been weakened to close a finding. So the walk goes deep while the verdict stays
    where it was: what this phase refuses, and how it says so, does not move.

    A safe scalar's subclass is copied here rather than walked, for the reason `frozen` refuses
    one rather than taking it apart: `str` and `bytes` are `Sequence`s, and walking one yields
    its own characters instead of anything nested. That ground covers the `Sequence` face only,
    so **the `Mapping` face is checked before every buffer and scalar arm**: a class subclassing
    `str` and `Mapping`, or `bytearray` and `Mapping`, needs no forgery at all. The `bytearray`
    arm used to precede it, so a `bytearray`+`Mapping` hybrid was copied on its buffer face and
    never reached `stored_entries` — its `.get` was free to contradict its `.items()` with no
    cross-check between them. `VERDICT-e311f8b` filed that as a finding, and the ordering below
    now puts the mapping cross-check ahead of every arm that would copy a value on another face.

    There is **no leaf test here**, and there used to be one. `proved_copy` decides leaf status
    before it ever calls this function and returns at that point, so the guard on entry could not
    be reached by any value; an earlier draft of this docstring presented it as live, which
    `VERDICT-e311f8b` filed. Leaf status is `is_immutable_leaf` for the F153 reason — membership
    consults a metaclass's `__eq__`, identity cannot be forged — and it is decided one frame up.

    The `str`/`bytes`/`bytearray` family tests are `issubclass(type(value), ...)` rather than
    `isinstance`, and that is a second forgery, not the F153 one. `isinstance` falls back to the
    instance's `__class__` attribute when the direct type check fails, so an unrelated class
    publishing `__class__ = str` passed the guard — and the unbound `str.__str__` slot the branch
    then calls does *not* consult the instance, so it raised `TypeError` out of this seam.
    `VERDICT-6d20929` filed that as P2-2 against the repair above.

    The container arm deliberately does **not** carry that discipline, and the sentence claiming
    it does was false. `VERDICT-e311f8b` filed the false claim, and the repair is to the claim,
    not to the guard. What actually happens to an imposter publishing `__class__ = str`: it fails
    every `issubclass(type(value), ...)` scalar arm, reaches
    `isinstance(value, (AbstractSet, Sequence))`, which *does* consult `__class__`, and — since
    `str` is a registered `Sequence` — is admitted to the member walk, fails to iterate, and is
    returned by the **refusal handler** below with a divergence finding. It never reaches the
    uncopied return at the end of this function. The returned value is identical on both routes,
    which is why the false sentence survived four verdicts undetected.

    Narrowing this arm to `issubclass(type(value), ...)` to make the old sentence true was tried
    and **reverted, because it re-opens F131**: `test_f131_ingress_guard` drove a two-faced
    container reading to `TOPOLOGY_PASS` under the narrowed guard. `isinstance`'s breadth here is
    load-bearing in a way it is not on the scalar arms, and the asymmetry is principled. The
    scalar arms narrowed because they call *unbound builtin slots* that resolve on the real type,
    so admitting an instance-nominated face made the slot raise `TypeError` out of the seam
    (P2-2, P2-10). This arm calls no slot: it iterates, and iteration either works or is caught
    and reported as a refusal. Admitting too much here therefore costs a divergence finding on a
    value that is refused anyway, while admitting too little silently drops a hostile container
    out of the cross-check altogether. Broad admission plus a catching handler is fail-closed;
    narrow admission plus a silent fall-through is not.
    """
    if isinstance(value, Mapping):
        return _dead_mapping(value, path, trail)
    if issubclass(type(value), bytearray):
        # Two defects lived on this line, and `VERDICT-af0d227` traced only the first. `isinstance`
        # admitted an imposter publishing `__class__ = bytearray`, and `bytes()` then raised
        # `TypeError` out of this seam (P2-10, vector 1); `issubclass(type(value), ...)` closes that
        # the same way it closed P2-2 below. But `bytes(value)` also dispatches to a `__bytes__`
        # that an *ordinary* `bytearray` subclass owns — no forgery, so the repaired guard still
        # admits it — and that made attacker code choose the recorded dead copy while this arm
        # returned no divergence finding at all (vector 2, this lane's, silent where vector 1 was
        # loud). The copy is therefore taken through the builtin slot, which resolves on the real
        # type; it yields an *exact* `bytearray`, which has no `__bytes__`, so the `bytes()` that
        # makes the result immutable has nothing left to consult.
        return bytes(bytearray.__getitem__(value, slice(None))), ()
    if issubclass(type(value), str):
        # A `str` subclass is copied to its exact leaf type, never walked. `str(value)` would
        # dispatch to a `__str__` the subclass owns; `str.__str__` is the builtin slot, and on a
        # non-exact instance it returns a fresh exact `str`, so the recorded value is inert.
        return str.__str__(value), ()
    if issubclass(type(value), bytes):
        # The same, for `bytes`. `bytes(value)` consults a `__bytes__` the subclass owns, so the
        # whole-slice subscript of the builtin is taken instead; it yields an exact `bytes`.
        return bytes.__getitem__(value, slice(None)), ()
    if isinstance(value, (AbstractSet, Sequence)):
        is_set = isinstance(value, AbstractSet)
        try:
            copied, _, diverged = _proved_members(
                value,
                f"{path}.<member>" if is_set else f"{path}.<item>",
                trail,
                frozenset if is_set else tuple,
            )
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a container that will not be rebuilt is refused
            return value, (
                (
                    f"{path}: this container raised {safe_type_name(error)} when a dead copy "
                    "of it was built, so no copy of it exists to record"
                ),
            )
        return copied, diverged
    return value, ()


def _dead_mapping(
    value: Mapping[Any, Any], path: str, trail: tuple[int, ...]
) -> tuple[Any, tuple[str, ...]]:
    """One `.items()` read of a nested mapping, cross-checked and copied out of that read.

    `stored_entries` is contracted to return findings and is called here on a caller's live
    object one level below the top, so the read itself is held to answering: a mapping that
    will not be iterated at all has shown its two views agree no more than one whose subscript
    refuses. It is guarded here rather than inside `stored_entries`, because `observe` calls
    that function on values whose refusals are already stated at their own seams.
    """
    try:
        stored, divergence = stored_entries(value, path)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- a mapping that will not be read is refused
        return value, (
            (
                f"{path}: this mapping raised {safe_type_name(error)} when it was read by "
                "iteration, so there is no reading of it to judge"
            ),
        )
    copied: dict[Any, Any] = {}
    diverged: list[str] = list(divergence)
    for key, item in stored.items():
        copied_key, _, key_diverged = proved_copy(key, f"{path}.<key>", trail)
        copied_item, _, item_diverged = proved_copy(item, f"{path}.<value>", trail)
        copied[copied_key] = copied_item
        diverged.extend((*key_diverged, *item_diverged))
    return MappingProxyType(copied), tuple(diverged)


def proved_copy(
    value: object, path: str, seen: tuple[int, ...] = ()
) -> tuple[Any, tuple[str, ...], tuple[str, ...]]:
    """One dead copy, its immutability findings and its divergence findings, from one read.

    This is `immutability_findings`, `stored_entries` and `preparation.frozen` fused into a
    single recursive pass, and the fusion is the whole point. Run as three passes, each spent
    its own `.items()` read on the caller's live object: the pass that judged and the pass that
    copied were reading a mapping that is free to answer them differently. A `MappingProxyType`
    over a `dict` *subclass* — exactly a `MappingProxyType` by `type()`, so it clears every
    declared gate — need only stay honest for as many reads as the judging passes spend and
    answer the copying pass with attacker content, and a satisfied result then records what no
    validation ever saw. Freezing *first* is not the repair either: it discards the caller's
    `__getitem__`, so the divergence cross-check reconciles a dead copy with itself and can no
    longer refuse anything.

    So here there is exactly one `.items()` read per mapping, taken by `stored_entries`, and the
    `stored` dict that read produced is both what the live subscript is cross-checked against
    and what the returned copy is built from — at every depth. There is no later read for a
    hostile mapping to answer, and the live object is still reconciled against itself before its
    answer is accepted.

    Total and pure like the readers around it: handed one value, answering about that value
    only, reaching nothing and raising nothing out of a seam. A cycle is reported at the path
    where it closes rather than followed.

    Recognising a cycle by `id()` is necessary but **not sufficient**, and treating it as
    sufficient was a finding. A projection that rebuilds its nesting on every read never presents
    the same object twice, so the identity trail never fires and the walk descends forever until
    CPython raises `RecursionError` — out of a seam contracted to raise nothing, from a reader
    the callers trust to return findings. Depth is therefore bounded independently of identity by
    `MAX_PROJECTION_DEPTH`: a projection nested past it is *reported* at that path, which is what
    the guard promised for the cycle case all along. The bound is not a cap on legitimate data —
    the projections this package reads nest a handful of levels — it is the difference between an
    unbounded reading being a finding and it being a crash.

    Depth exhaustion is reported in the **divergence** channel, and the choice is forced rather
    than stylistic. `_dead_mapping` deliberately discards the nested immutability findings of the
    values below it, so a depth report placed in that channel alone is silently dropped on
    precisely the path that needs it — a bound that stops the crash and says nothing is a bound
    that converts a loud failure into a quiet one. Divergence findings propagate from every depth
    on every path, and an unterminating reading is in any case a refusal to be reconciled rather
    than a statement about immutability.

    But it is **not reported there instead of** the immutability channel, and saying so was
    F0023. The immutability channel was returned empty at the bound while `immutability_findings`
    reports `"... is nested deeper than N levels"` at that same depth, which broke the
    byte-identity this docstring asserts two paragraphs below and, far worse, handed
    `PreparationResult.__post_init__` — which refuses on exactly that channel — nothing at all
    about a projection too deep to read. A hostile projection needed only to nest past the bound
    to be admitted in silence. The bound now answers on both channels: `immutability_findings` is
    consulted at the exhausted depth so the verdict stays byte-identical, and the divergence
    report states why the walk stopped.

    The walk and the verdict are two answers, and they are deliberately not the same one. Every
    type `preparation.frozen` rebuilds is walked, so the cross-check and the copy reach every
    depth `frozen` reaches and nothing survives to be read live a second time. But a value
    outside exact `MappingProxyType`, `tuple` and `frozenset` is still reported at its own path
    and nothing below it is reported again, so the immutability findings stay byte-identical to
    `immutability_findings` on the same value and `PreparationResult.__post_init__` refuses
    exactly what it refuses today. See `_dead_copy`.
    """
    if is_immutable_leaf(value):
        return value, (), ()
    if id(value) in seen:
        return value, (f"{path} refers to itself",), ()
    if len(seen) >= MAX_PROJECTION_DEPTH:
        return (
            value,
            immutability_findings(value, path, seen),
            (
                (
                    f"{path}: this projection nests deeper than {MAX_PROJECTION_DEPTH} levels, "
                    "so no reading of it that terminates exists to judge"
                ),
            ),
        )
    trail = (*seen, id(value))
    if type(value) is MappingProxyType:
        try:
            stored, divergence = stored_entries(value, path)
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a mapping that will not be read is refused
            return (
                value,
                (),
                (
                    (
                        f"{path}: this mapping raised {safe_type_name(error)} when it was "
                        "read by iteration, so there is no reading of it to judge"
                    ),
                ),
            )
        copied: dict[Any, Any] = {}
        nested_findings: list[str] = []
        diverged: list[str] = list(divergence)
        for key, item in stored.items():
            copied_key, key_nested, key_diverged = proved_copy(
                key, f"{path}.<key>", trail
            )
            copied_item, item_nested, item_diverged = proved_copy(
                item, f"{path}.<value>", trail
            )
            copied[copied_key] = copied_item
            nested_findings.extend((*key_nested, *item_nested))
            diverged.extend((*key_diverged, *item_diverged))
        return MappingProxyType(copied), tuple(nested_findings), tuple(diverged)
    if type(value) is tuple:
        return _proved_members(value, f"{path}.<item>", trail, tuple)
    if type(value) is frozenset:
        return _proved_members(value, f"{path}.<member>", trail, frozenset)
    copied_value, diverged = _dead_copy(value, path, trail)
    return (
        copied_value,
        (f"{path} holds a {safe_type_name(value)}, which is not deeply immutable",),
        diverged,
    )
