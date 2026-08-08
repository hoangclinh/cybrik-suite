"""Typed terminal classes and the exact classification precedence of section 8.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Every way the rehearsal can stop maps to exactly one of the five terminal classes, and the
mapping is carried by the exception type rather than by a string a caller might mistype.
A raised error therefore cannot claim a class that its type does not already declare.

The hierarchy is immutable in both directions. A terminal class is a class attribute, so no
instance can rewrite the class it reports; the reason is read out of `args`, so no caller
can edit the explanation after the fact. An unexplained terminal class is refused at
construction: a classified stop with no reason is not evidence.

`resolve_outcome` implements the fixed precedence of diagnosis section 8: any pre-consumption
item 1-3 refusal is `PRECHECK_ABORT` and outranks everything; after consumption
`STOP_CONTROL` overrides every diagnostic class; a publication-projection failure outranks an
internal ingress failure; and a fully satisfied record is the only `TOPOLOGY_PASS`, which is
the weakest class and can never win over a candidate failure.
"""

from __future__ import annotations

from collections.abc import Iterable
from types import MappingProxyType
from typing import ClassVar

from .constants import (
    FAIL_INTERNAL_INGRESS,
    FAIL_PUBLICATION,
    OUTCOME_PRECEDENCE,
    PRECHECK_ABORT,
    STOP_CONTROL,
    TOPOLOGY_PASS,
)

__all__ = [  # noqa: RUF022 - repository contract requires Python lexical order
    "AdmissionRefused",
    "GrantBindingError",
    "InternalIngressFailure",
    "PrecheckAbort",
    "PublicationFailure",
    "StopControl",
    "TERMINAL_ERRORS",
    "TopologyRehearsalError",
    "error_for",
    "resolve_outcome",
]


class TopologyRehearsalError(Exception):
    """Base failure. It declares no terminal class of its own.

    A bare base error must never be able to masquerade as a classified outcome, so
    `outcome` is `None` here and only a concrete subclass may name a terminal class.
    """

    outcome: ClassVar[str | None] = None

    def __init__(self, reason: str) -> None:
        if not isinstance(reason, str) or not reason:
            raise ValueError(
                f"{type(self).__name__} requires a non-empty reason: an unexplained "
                "terminal class is not evidence"
            )
        super().__init__(reason)

    @property
    def reason(self) -> str:
        """The exact explanation the error was raised with, read-only."""
        return self.args[0]


class PrecheckAbort(TopologyRehearsalError):
    """A refusal raised before the one attempt is consumed (section 7 items 1-3)."""

    outcome: ClassVar[str | None] = PRECHECK_ABORT


class GrantBindingError(PrecheckAbort):
    """The signed grant does not bind the record, the runner or the reviewed topology."""


class AdmissionRefused(PrecheckAbort):
    """The host, the control repositories or the ledger refused admission."""


class StopControl(TopologyRehearsalError):
    """A stop control fired after consumption; it overrides every diagnostic class.

    Section 8 names the control invariants it covers: a non-internal or multiple network
    attachment, an image pull or install prompt, any role, migration, product query, pytest
    or unrelated service effect, a timeout and an incomplete teardown.
    """

    outcome: ClassVar[str | None] = STOP_CONTROL


class PublicationFailure(TopologyRehearsalError):
    """The five publication projections did not all agree on the reviewed binding."""

    outcome: ClassVar[str | None] = FAIL_PUBLICATION


class InternalIngressFailure(TopologyRehearsalError):
    """The publication agreed, but the healthy container was not reached through it.

    Section 8 reserves this class for exactly that reading: the container's own readiness
    and the bounded host TCP probe. A network that is not internal, or that holds anything
    other than the one attachment, is a control invariant and belongs to `StopControl`.
    """

    outcome: ClassVar[str | None] = FAIL_INTERNAL_INGRESS


# Every failing terminal class, keyed by the class it declares. A pass is not an error and
# therefore has no entry: the table is read-only so no caller can install one.
TERMINAL_ERRORS = MappingProxyType(
    {
        PRECHECK_ABORT: PrecheckAbort,
        STOP_CONTROL: StopControl,
        FAIL_PUBLICATION: PublicationFailure,
        FAIL_INTERNAL_INGRESS: InternalIngressFailure,
    }
)


def error_for(outcome: object) -> type[TopologyRehearsalError]:
    """The typed error class for a failing terminal class.

    A passing or unknown class has no error, so asking for one is a programming fault
    rather than a recoverable condition.
    """
    try:
        error = TERMINAL_ERRORS.get(outcome)  # type: ignore[arg-type]
    except TypeError:
        error = None
    if error is None:
        raise ValueError(f"{outcome!r} is not a failing terminal class")
    return error


def resolve_outcome(candidates: Iterable[str]) -> str:
    """The single terminal class for a set of candidate classes, by fixed precedence.

    The caller's iterable is materialised before it is read, so a generator is consumed
    exactly once here and a sequence is left untouched. With no candidate at all the
    weakest class wins, which is the only way a `TOPOLOGY_PASS` can be reached.
    """
    observed = tuple(candidates)
    unknown = tuple(
        candidate for candidate in observed if candidate not in OUTCOME_PRECEDENCE
    )
    if unknown:
        raise ValueError(f"not terminal classes: {unknown!r}")
    return min(
        observed,
        key=OUTCOME_PRECEDENCE.index,
        default=TOPOLOGY_PASS,
    )
