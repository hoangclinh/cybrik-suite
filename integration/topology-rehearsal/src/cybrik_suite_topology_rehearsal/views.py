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


def stored_entries(
    mapping: Mapping[str, Any], label: str
) -> tuple[dict[str, Any], tuple[str, ...]]:
    """What a mapping *stores*, and every entry whose subscript disagrees with it.

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
        if subscripted is value:
            continue
        try:
            agreed = (
                type(subscripted) is type(value)
                and (subscripted == value) is True
                and (value == subscripted) is True
            )
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
    where it closes rather than followed. Only exact `MappingProxyType`, `tuple` and `frozenset`
    are walked, and every other type is reported at its own path, so the immutability findings
    are byte-identical to `immutability_findings` on the same value.
    """
    if type(value) in IMMUTABLE_LEAVES:
        return value, (), ()
    if id(value) in seen:
        return value, (f"{path} refers to itself",), ()
    trail = (*seen, id(value))
    if type(value) is MappingProxyType:
        stored, divergence = stored_entries(value, path)
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
    return (
        value,
        (f"{path} holds a {type(value).__name__}, which is not deeply immutable",),
        (),
    )
