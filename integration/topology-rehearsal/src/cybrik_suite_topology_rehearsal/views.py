"""Mapping-view reconciliation: walk a projection, prove it immutable, judge its two views.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Every function here is total and pure. Each is handed one value and answers about that value
only: it reaches nothing, holds nothing between calls and raises nothing out of a seam whose
callers are reducers contracted to return findings.

These are the machinery `observe` and `preparation` share for reading a mapping that arrived
through an injected port. Four of them were authored in `observe` and are held here so that
module stays inside its reviewed size bound; `observe` re-imports them, so every name a caller
already reached for through `observe` still resolves there. Nothing about that code moved with
them. `proved_copy` is the one judgement authored here: it fuses the walk, the reconciliation
and the copy into a single read so that what is judged and what is recorded cannot differ.

The one property they all turn on is that a mapping has two views of itself — what its own
iteration yields and what its subscript returns — and that a projection is only trustworthy
where those two agree. `MappingProxyType` over a `dict` *subclass* is exactly a
`MappingProxyType` by `type()`, so it passes every declared read-only-mapping gate and the
deep immutability proof while overloading `__getitem__`. A reader that consults one view while
a later consumer records the other is exactly the hole these reconcile.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from collections.abc import Set as AbstractSet
from types import MappingProxyType
from typing import Any

__all__ = [
    "IMMUTABLE_LEAVES",
    "immutability_findings",
    "nested",
    "proved_copy",
    "stored_entries",
]


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


def immutability_findings(
    value: object, path: str, seen: tuple[int, ...] = ()
) -> tuple[str, ...]:
    """Report every nested value that is not already deeply immutable.

    Total and pure like the readers around it: it is handed one value and answers about that
    value only, reaching nothing and raising nothing. A cycle is reported at the path where it
    closes rather than followed, so an unbounded projection is a finding, not a recursion.
    """
    if type(value) in IMMUTABLE_LEAVES:
        return ()
    if id(value) in seen:
        return (f"{path} refers to itself",)
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
    return (f"{path} holds a {type(value).__name__}, which is not deeply immutable",)


def _states_the_same_value(stored: object, other: object) -> bool:
    """Whether a second view's answer is the value the one `.items()` read stored.

    Identity is the fast path; a mapping that rebuilds its values on each read states the same
    value through both views and is honest. Bare `==` is not the fallback, because `__eq__` is
    defined by the object being judged, so the exact same type and a literal `True` are demanded
    in both directions. Raising propagates to the caller, which records it as a refusal: an
    object that will not be compared has not agreed.
    """
    if other is stored:
        return True
    return (
        type(other) is type(stored)
        and (other == stored) is True
        and (stored == other) is True
    )


def stored_entries(
    mapping: Mapping[str, Any], label: str
) -> tuple[dict[str, Any], tuple[str, ...]]:
    """What a mapping *stores*, and every entry whose subscript or `.get` disagrees with it.

    The same shape of hole `local_presence_findings` closed, written once for a whole
    inventory instead of one field. A mapping is validated here by iterating it — `keyed`
    iterates and `preparation.frozen` rebuilds from `.items()` — so a judgement that reads the
    values back through `__getitem__` is judging something no consumer records.
    `MappingProxyType` over a `dict` *subclass* is exactly a `MappingProxyType` by `type()`, so
    such a mapping passes every declared read-only-mapping gate and the deep immutability proof
    while overloading its subscript.

    A recorded value carries exactly what `.items()` yielded only where the recording is built
    from that same read. That used to be `prepare`'s ingress alone, and by a *separate* read: a
    `PreparationResult` built directly or copied by `dataclasses.replace` kept the caller's own
    mapping object as its field, so the recorded value was no copy at all. `proved_copy` below
    is what binds the two together on every path — it hands back the `stored` dict this function
    already read, so what was judged and what is recorded are one read's answer.

    The subscript is kept as a cross-check rather than dropped, because `__getitem__` is a
    live protocol on these mappings elsewhere in the package — `runner._selected_identity`
    and `grant`'s own reductions read `mapping[key]`. A disagreement in either direction is a
    refusal, so the two views cannot diverge whichever one a later reader happens to use.

    A subscript that refuses to answer at all is a disagreement too, not an exception: passing
    `keyed` does not make a mapping subscriptable, and the callers here are reducers contracted
    to return findings and a `__post_init__` documented to raise `ValueError`.

    `.get` is cross-checked for the same reason and is not a lesser accessor than `__getitem__`
    — it is the *primary* one. Every verdict this package reaches over a live projection is read
    through it: `observe.validate_internal_network` reads `projection.get(NETWORK_INTERNAL_KEY)`
    and `projection.get(NETWORK_ATTACHMENT_KEY)`, `validate_publication`'s reducers read
    `bindings.get`, `entry.get` and `listener.get`, and `nested` above walks every path by
    `current.get(key)`. Cross-checking iteration against the subscript alone therefore proved
    agreement between two views that no validator consults, while the view every validator does
    consult was free to answer differently — a reading honest to `.items()` and `__getitem__` and
    hostile only to `.get` cleared the whole cross-check and was then copied on its stored face,
    so the receipt attested an isolation the same live object denied. A third accessor is a third
    view of one entry, and disagreement in any of them is a refusal.

    Agreement is the *value*, not the object. Identity is the fast path; a mapping that
    rebuilds its values on subscript states the same value through both views and is honest,
    so refusing it was a defect. Bare `==` is not the fallback, because `__eq__` is defined by
    the object being judged and the reader this cross-check protects (`runner._selected_identity`
    and `grant`'s reductions) receives the subscripted object, not the stored one. The fallback
    therefore demands the exact same type and `True` — not merely something truthy — from the
    comparison in both directions, so an object that claims equality with anything, that claims
    it one way only, or that is a lookalike of another type is still refused. A comparison that
    raises is a refusal as well, since an object that will not be compared has not agreed.
    """
    stored = dict(mapping.items())
    findings: list[str] = []
    for key, value in stored.items():
        try:
            subscripted = mapping[key]
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a mapping that will not answer is refused
            findings.append(
                f"{label}: {key} raised {type(error).__name__} when read by subscript while "
                f"this mapping stores {value!r}, so its two views of one entry disagree"
            )
            continue
        try:
            agreed = _states_the_same_value(value, subscripted)
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a value that will not compare is refused
            findings.append(
                f"{label}: {key} raised {type(error).__name__} when the object its subscript "
                f"returned was compared with the {value!r} this mapping stores, so its two "
                "views of one entry cannot be shown to agree"
            )
            continue
        if not agreed:
            findings.append(
                f"{label}: {key} reads by subscript as the {type(subscripted).__name__} "
                f"{subscripted!r} while this mapping stores the {type(value).__name__} "
                f"{value!r}, which are distinct objects that do not compare exactly equal in "
                "both directions, so its two views of one entry disagree"
            )
            continue
        try:
            fetched = mapping.get(key)
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a mapping that will not answer is refused
            findings.append(
                f"{label}: {key} raised {type(error).__name__} when read by `.get` while this "
                f"mapping stores {value!r}, so its two views of one entry disagree"
            )
            continue
        try:
            agreed = _states_the_same_value(value, fetched)
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a value that will not compare is refused
            findings.append(
                f"{label}: {key} raised {type(error).__name__} when the object its `.get` "
                f"returned was compared with the {value!r} this mapping stores, so its two "
                "views of one entry cannot be shown to agree"
            )
            continue
        if not agreed:
            findings.append(
                f"{label}: {key} reads by `.get` as the {type(fetched).__name__} "
                f"{fetched!r} while this mapping stores the {type(value).__name__} "
                f"{value!r}, which are distinct objects that do not compare exactly equal in "
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
    cross-checked at all. This copies and cross-checks exactly as deep as `frozen` rebuilds.

    It reports nothing further about immutability, and that is deliberate. Widening the
    *verdict* to match this walk would make a nested plain `dict` proved rather than reported,
    and `PreparationResult.__post_init__` refuses on exactly that finding today — a control
    would have been weakened to close a finding. So the walk goes deep while the verdict stays
    where it was: what this phase refuses, and how it says so, does not move.

    A safe scalar's subclass is a leaf here for the reason `frozen` refuses one rather than
    taking it apart: `str` and `bytes` are `Sequence`s, and walking one yields its own
    characters instead of anything nested.
    """
    if isinstance(value, IMMUTABLE_LEAVES):
        return value, ()
    if isinstance(value, bytearray):
        return bytes(value), ()
    if isinstance(value, Mapping):
        return _dead_mapping(value, path, trail)
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
                    f"{path}: this container raised {type(error).__name__} when a dead copy "
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
                f"{path}: this mapping raised {type(error).__name__} when it was read by "
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

    The walk and the verdict are two answers, and they are deliberately not the same one. Every
    type `preparation.frozen` rebuilds is walked, so the cross-check and the copy reach every
    depth `frozen` reaches and nothing survives to be read live a second time. But a value
    outside exact `MappingProxyType`, `tuple` and `frozenset` is still reported at its own path
    and nothing below it is reported again, so the immutability findings stay byte-identical to
    `immutability_findings` on the same value and `PreparationResult.__post_init__` refuses
    exactly what it refuses today. See `_dead_copy`.
    """
    if type(value) in IMMUTABLE_LEAVES:
        return value, (), ()
    if id(value) in seen:
        return value, (f"{path} refers to itself",), ()
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
                        f"{path}: this mapping raised {type(error).__name__} when it was "
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
        (f"{path} holds a {type(value).__name__}, which is not deeply immutable",),
        diverged,
    )
