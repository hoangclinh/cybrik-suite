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
    "MAX_PROJECTION_DEPTH",
    "immutability_findings",
    "is_immutable_leaf",
    "nested",
    "proved_copy",
    "stored_entries",
]

# How deep a projection may nest before the walk stops and reports it. The walk recurses once
# per level, so this must stay well below the interpreter's own limit: the seam is contracted
# to return findings, and a `RecursionError` is not a finding. See `proved_copy`.
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
    caller deciding leaf status must call this function instead of re-deriving the test.

    `type(value) in IMMUTABLE_LEAVES` was **not** this test, and that was F153. Membership is
    defined as `any(e is x or e == x)`, so it consults `__eq__` on the class object — which a
    metaclass owns. A class whose metaclass answers `True` to every comparison was therefore
    admitted as a builtin leaf, and every control resting on that admission unfolded on a lie:
    the value skipped the immutability walk, skipped `proved_copy`'s deep walk, and reached the
    equality fallback that is only safe because the leaf types cannot override comparison.

    Identity cannot be forged: `is` is the interpreter's, not the judged object's. Nothing is
    widened here — a leaf subclass without a lying metaclass was already excluded, because
    `MySubclass == int` is `False` — so this closes the forgery and moves nothing else.
    """
    return any(leaf is type(value) for leaf in IMMUTABLE_LEAVES)


def _safe_repr(value: object) -> str:
    """`repr(value)`, or a stated placeholder when the value refuses to be represented.

    Every finding below interpolates the judged value, and the judged value arrived through an
    injected port. `repr()` is attacker-controlled code: a `__repr__` that raises turned the
    *report* of a divergence into an exception escaping a seam whose callers are reducers
    contracted to return findings, so the hostile reading suppressed its own finding by
    refusing to be printed. Formatting is therefore never allowed to raise.
    """
    try:
        return repr(value)
    except (KeyboardInterrupt, SystemExit):
        raise
    except BaseException:  # noqa: BLE001 -- a value that will not be printed is still reported
        return f"<unrepresentable {_safe_type_name(value)}>"


def _safe_type_name(value: object) -> str:
    """`type(value).__name__`, which a hostile `__name__` descriptor can also refuse."""
    try:
        name = type(value).__name__
    except (KeyboardInterrupt, SystemExit):
        raise
    except BaseException:  # noqa: BLE001 -- a type that will not be named is still reported
        return "<unnameable type>"
    return name if isinstance(name, str) else "<unnameable type>"


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
    return (f"{path} holds a {type(value).__name__}, which is not deeply immutable",)


def _states_the_same_value(stored: object, other: object) -> bool:
    """Whether a second view's answer is the value the one `.items()` read stored.

    Identity is the fast path; a mapping that rebuilds its values on each read states the same
    value through both views and is honest, so refusing it outright was a defect.

    The fallback used to demand the exact same type and a literal `True` in both directions, and
    argued that this defeated a lying comparison. **It did not, and that was F135.** Every term of
    that conjunction is supplied by the hostile reading itself: both operands come from the same
    mapping and so does the type they share, so an object answering `True` to every comparison
    satisfied the whole test while its two views stated different values — measured, one network
    attachment against two, cleared with no divergence and carried to `TOPOLOGY_PASS`. A control
    adjudicated by the code it is judging is not a control.

    Agreement is therefore never decided by an `__eq__` the judged object defines. Equality is
    consulted only where the comparison belongs to the interpreter rather than to the reading:
    the exact builtin leaf types, which cannot carry an overriding `__eq__` because their identity
    is checked by `is_immutable_leaf`. Every other value must be the *same object* through both
    views.

    That guard used to be spelled `type(stored) in IMMUTABLE_LEAVES`, and this docstring claimed it
    excluded subclasses. **It did not, and that was F153.** Membership consults `__eq__` on the
    class, which a metaclass owns, so a forged type reached this fallback and was then trusted to
    grade itself — the same shape of defect as F135, one level up. The guard is now an identity
    test, which the judged object cannot supply.

    This is deliberately strict, and the strictness is **decided, not pending**. A mapping that
    rebuilds a non-leaf value on each read is refused rather than trusted, because there is no
    way to distinguish it from a two-faced one without asking the object to grade itself. The
    honest rebuilding case this fallback was written for (`RebuildsEachSubscript`, which rebuilds
    `str`) is a leaf and is still accepted. Structural recursion over
    `MappingProxyType`/`tuple`/`frozenset` would widen it, and `VERDICT-e311f8b` filed the
    earlier wording of this paragraph as a finding precisely because it shipped that strictness
    live while describing the decision as still open. It is not open: the refusal stands, and
    widening it would be a new change requiring its own evidence, not the resolution of a
    deferral recorded here.

    Raising propagates to the caller, which records it as a refusal: an object that will not be
    compared has not agreed.
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


def _key_set_findings(
    mapping: Mapping[str, Any], stored: dict[str, Any], label: str
) -> tuple[str, ...]:
    """Whether the keys a mapping announces are the keys it stored under one `.items()` read.

    `stored` is one read's answer. A mapping whose `__iter__`, `keys()` or `__len__` answers for
    an entry that read never yielded has a view no part of this cross-check would otherwise
    reach, and `.get`/`__getitem__` are exactly where a later validator would meet it.
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
    unstored = [key for key in announced if key not in stored]
    for key in unstored:
        findings.append(
            f"{label}: {_safe_repr(key)} is announced by iteration but was never yielded by "
            "`.items()`, "
            "so this entry is answered by the accessors validators read while being absent "
            "from the one read this cross-check judges"
        )
    if len(announced) != len(stored) and not unstored:
        findings.append(
            f"{label}: iteration announces {len(announced)} keys while `.items()` yielded "
            f"{len(stored)} distinct entries, so at least one key collapsed silently"
        )
    try:
        declared_length = len(mapping)
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception as error:  # noqa: BLE001 -- a mapping that will not be sized is refused
        findings.append(
            f"{label}: this mapping raised {type(error).__name__} when it was asked its "
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

    Agreement is decided by `_states_the_same_value`, and **this docstring used to describe a
    test that function no longer performs.** It claimed the fallback "demands the exact same type
    and `True` in both directions", and argued that this defeated a lying comparison. F135
    refuted exactly that: every term of the conjunction is supplied by the hostile reading
    itself, so an object answering `True` to every comparison satisfied all of it while its two
    views stated different values. The bidirectional-equality fallback is therefore **no longer
    reached for anything but an exact builtin leaf**, whose comparison belongs to the interpreter
    rather than to the reading. For every other value, agreement means the *same object* through
    all three views. `VERDICT-e311f8b` filed the stale wording as a finding in its own right,
    because a docstring that describes a discarded control is a false statement of what is
    enforced here. See `_states_the_same_value` for the decided strictness.

    The cross-checked key set is **not** taken from `.items()` alone. `stored` is what `.items()`
    yielded, but a mapping is free to announce keys through `__iter__`, `keys()` and `__len__`
    that its `.items()` never yields — and those are precisely the entries a `.get`-based
    validator would read while this cross-check looked away. Every key the mapping announces is
    therefore reconciled against the keys it actually stored, and a discrepancy in either
    direction is a refusal. Duplicate keys yielded by `.items()` collapse into `stored` silently,
    so the yielded count is checked against the stored count as well.

    Every value interpolated into a finding is formatted through `_safe_repr`: `repr()` is
    attacker-controlled code, and a `__repr__` that raises must not let a hostile reading
    suppress the report of its own divergence.
    """
    stored = dict(mapping.items())
    findings: list[str] = list(_key_set_findings(mapping, stored, label))
    for key, value in stored.items():
        try:
            subscripted = mapping[key]
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a mapping that will not answer is refused
            findings.append(
                f"{label}: {key} raised {type(error).__name__} when read by subscript while "
                f"this mapping stores {_safe_repr(value)}, so its two views of one entry disagree"
            )
            continue
        try:
            agreed = _states_the_same_value(value, subscripted)
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a value that will not compare is refused
            findings.append(
                f"{label}: {key} raised {type(error).__name__} when the object its subscript "
                f"returned was compared with the {_safe_repr(value)} this mapping stores, so its two "
                "views of one entry cannot be shown to agree"
            )
            continue
        if not agreed:
            findings.append(
                f"{label}: {key} reads by subscript as the {_safe_type_name(subscripted)} "
                f"{_safe_repr(subscripted)} while this mapping stores the "
                f"{_safe_type_name(value)} {_safe_repr(value)}, which are distinct objects "
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
                f"{label}: {key} raised {type(error).__name__} when read by `.get` while this "
                f"mapping stores {_safe_repr(value)}, so its two views of one entry disagree"
            )
            continue
        try:
            agreed = _states_the_same_value(value, fetched)
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception as error:  # noqa: BLE001 -- a value that will not compare is refused
            findings.append(
                f"{label}: {key} raised {type(error).__name__} when the object its `.get` "
                f"returned was compared with the {_safe_repr(value)} this mapping stores, so its two "
                "views of one entry cannot be shown to agree"
            )
            continue
        if not agreed:
            findings.append(
                f"{label}: {key} reads by `.get` as the {_safe_type_name(fetched)} "
                f"{_safe_repr(fetched)} while this mapping stores the "
                f"{_safe_type_name(value)} {_safe_repr(value)}, which are distinct objects "
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

    Recognising a cycle by `id()` is necessary but **not sufficient**, and treating it as
    sufficient was a finding. A projection that rebuilds its nesting on every read never presents
    the same object twice, so the identity trail never fires and the walk descends forever until
    CPython raises `RecursionError` — out of a seam contracted to raise nothing, from a reader
    the callers trust to return findings. Depth is therefore bounded independently of identity by
    `MAX_PROJECTION_DEPTH`: a projection nested past it is *reported* at that path, which is what
    the guard promised for the cycle case all along. The bound is not a cap on legitimate data —
    the projections this package reads nest a handful of levels — it is the difference between an
    unbounded reading being a finding and it being a crash.

    Depth exhaustion is reported in the **divergence** channel, not the immutability one, and the
    choice is forced rather than stylistic. `_dead_mapping` deliberately discards the nested
    immutability findings of the values below it, so that the verdict this phase reaches stays
    byte-identical to `immutability_findings` and `PreparationResult.__post_init__` refuses
    exactly what it refuses today. A depth report placed in that channel is therefore silently
    dropped on precisely the path that needs it — a bound that stops the crash and says nothing
    is a bound that converts a loud failure into a quiet one. Divergence findings propagate from
    every depth on every path, and an unterminating reading is in any case a refusal to be
    reconciled rather than a statement about immutability.

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
            (),
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
