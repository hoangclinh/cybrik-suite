"""Mapping-view reconciliation: walk a projection, prove it immutable, judge its two views.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Every function here is total and pure. Each is handed one value and answers about that value
only: it reaches nothing, holds nothing between calls and raises nothing out of a seam whose
callers are reducers contracted to return findings.

These four are the machinery `observe` and `preparation` share for reading a mapping that
arrived through an injected port. They were authored in `observe` and are held here so that
module stays inside its reviewed size bound; `observe` re-imports them, so every name a caller
already reached for through `observe` still resolves there. Nothing about the code moved with
them: this module is a holding place, not a new judgement.

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
    iterates, `preparation.frozen` rebuilds from `.items()`, and every recorded copy carries
    exactly what `.items()` yielded — so a judgement that reads the values back through
    `__getitem__` is judging something no consumer records. `MappingProxyType` over a `dict`
    *subclass* is exactly a `MappingProxyType` by `type()`, so such a mapping passes every
    declared read-only-mapping gate and the deep immutability proof while overloading its
    subscript.

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
