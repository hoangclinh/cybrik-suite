"""Typed terminal classes and the exact classification precedence of section 8.

Status: `RED — TESTS ONLY — RUNNER NOT IMPLEMENTED`.

Every way the rehearsal can stop maps to exactly one of the five terminal classes, and the
mapping is carried by the exception type rather than by a string a caller might mistype.
`resolve_outcome` implements the fixed precedence: before consumption any item 1–3 failure
is `PRECHECK_ABORT`; after consumption `STOP_CONTROL` overrides every diagnostic class; a
fully satisfied record is the only `TOPOLOGY_PASS`.
"""

from __future__ import annotations

import pytest

import fakes
from conftest import load_c8, require_c8_attr

TERMINAL_CLASSES = {
    "PrecheckAbort": fakes.PRECHECK_ABORT,
    "StopControl": fakes.STOP_CONTROL,
    "PublicationFailure": fakes.FAIL_PUBLICATION,
    "InternalIngressFailure": fakes.FAIL_INTERNAL_INGRESS,
}

# Pre-consumption refusals are a `PRECHECK_ABORT` specialisation: they must never be
# catchable as a consumed-attempt class, and must never award topology-attempt credit.
PRECHECK_SPECIALISATIONS = ("GrantBindingError", "AdmissionRefused")


@pytest.fixture(name="errors")
def errors_module():
    return load_c8("errors")


def test_the_base_error_is_an_exception_carrying_a_reason(errors) -> None:
    base = require_c8_attr(errors, "TopologyRehearsalError")
    assert issubclass(base, Exception)
    raised = base("something specific went wrong")
    assert raised.reason == "something specific went wrong"
    assert str(raised) == "something specific went wrong"


def test_the_base_error_declares_no_terminal_class_of_its_own(errors) -> None:
    """A bare base error must not be able to masquerade as a classified outcome."""
    base = require_c8_attr(errors, "TopologyRehearsalError")
    assert base.outcome is None


@pytest.mark.parametrize("name", sorted(TERMINAL_CLASSES))
def test_every_terminal_class_has_its_own_typed_error(errors, name: str) -> None:
    error = require_c8_attr(errors, name)
    base = require_c8_attr(errors, "TopologyRehearsalError")
    assert issubclass(error, base)
    assert error.outcome == TERMINAL_CLASSES[name]


@pytest.mark.parametrize("name", sorted(TERMINAL_CLASSES))
def test_a_raised_terminal_error_carries_both_class_and_reason(errors, name: str) -> None:
    error = require_c8_attr(errors, name)
    with pytest.raises(error) as caught:
        raise error("exact reason")
    assert caught.value.outcome == TERMINAL_CLASSES[name]
    assert caught.value.reason == "exact reason"


def test_a_terminal_error_refuses_an_empty_reason(errors) -> None:
    """An unexplained terminal class is not evidence; it must fail loudly."""
    error = require_c8_attr(errors, "StopControl")
    with pytest.raises(ValueError):
        error("")


@pytest.mark.parametrize("name", PRECHECK_SPECIALISATIONS)
def test_pre_consumption_refusals_specialise_precheck_abort(errors, name: str) -> None:
    error = require_c8_attr(errors, name)
    assert issubclass(error, require_c8_attr(errors, "PrecheckAbort"))
    assert error.outcome == fakes.PRECHECK_ABORT


def test_the_terminal_error_table_covers_every_failing_class_and_no_pass(errors) -> None:
    table = require_c8_attr(errors, "TERMINAL_ERRORS")
    assert set(table) == set(TERMINAL_CLASSES.values())
    assert fakes.TOPOLOGY_PASS not in table, "a pass is not an error"
    for outcome, error in dict(table).items():
        assert error.outcome == outcome


def test_error_for_returns_the_typed_class_for_a_known_outcome(errors) -> None:
    error_for = require_c8_attr(errors, "error_for")
    assert error_for(fakes.FAIL_PUBLICATION) is require_c8_attr(
        errors, "PublicationFailure"
    )


def test_error_for_refuses_an_unknown_or_passing_outcome(errors) -> None:
    error_for = require_c8_attr(errors, "error_for")
    for outcome in (fakes.TOPOLOGY_PASS, "MADE_UP_CLASS", "", None):
        with pytest.raises(ValueError):
            error_for(outcome)


def test_no_candidate_failure_resolves_to_a_topology_pass(errors) -> None:
    assert require_c8_attr(errors, "resolve_outcome")(()) == fakes.TOPOLOGY_PASS


@pytest.mark.parametrize(
    ("candidates", "expected"),
    [
        ((fakes.STOP_CONTROL,), fakes.STOP_CONTROL),
        ((fakes.FAIL_PUBLICATION,), fakes.FAIL_PUBLICATION),
        ((fakes.FAIL_INTERNAL_INGRESS,), fakes.FAIL_INTERNAL_INGRESS),
        # STOP_CONTROL overrides every diagnostic class after consumption.
        ((fakes.FAIL_INTERNAL_INGRESS, fakes.STOP_CONTROL), fakes.STOP_CONTROL),
        ((fakes.FAIL_PUBLICATION, fakes.STOP_CONTROL), fakes.STOP_CONTROL),
        # A publication-projection failure outranks an ingress failure.
        (
            (fakes.FAIL_INTERNAL_INGRESS, fakes.FAIL_PUBLICATION),
            fakes.FAIL_PUBLICATION,
        ),
        # A pre-consumption abort outranks everything.
        (
            (fakes.STOP_CONTROL, fakes.FAIL_PUBLICATION, fakes.PRECHECK_ABORT),
            fakes.PRECHECK_ABORT,
        ),
        # A pass among failures never wins.
        ((fakes.TOPOLOGY_PASS, fakes.FAIL_PUBLICATION), fakes.FAIL_PUBLICATION),
    ],
)
def test_resolve_outcome_applies_the_exact_fixed_precedence(
    errors, candidates: tuple[str, ...], expected: str
) -> None:
    assert require_c8_attr(errors, "resolve_outcome")(candidates) == expected


def test_resolve_outcome_is_order_independent(errors) -> None:
    resolve = require_c8_attr(errors, "resolve_outcome")
    candidates = (fakes.FAIL_INTERNAL_INGRESS, fakes.STOP_CONTROL, fakes.FAIL_PUBLICATION)
    assert resolve(candidates) == resolve(tuple(reversed(candidates)))


def test_resolve_outcome_refuses_an_unknown_class(errors) -> None:
    resolve = require_c8_attr(errors, "resolve_outcome")
    with pytest.raises(ValueError):
        resolve((fakes.STOP_CONTROL, "NOT_A_TERMINAL_CLASS"))


def test_resolve_outcome_accepts_any_iterable_without_consuming_the_caller_s(
    errors,
) -> None:
    resolve = require_c8_attr(errors, "resolve_outcome")
    candidates = [fakes.FAIL_PUBLICATION, fakes.STOP_CONTROL]
    assert resolve(candidates) == fakes.STOP_CONTROL
    assert candidates == [fakes.FAIL_PUBLICATION, fakes.STOP_CONTROL]


def test_errors_exports_exactly_its_typed_surface(errors) -> None:
    assert set(require_c8_attr(errors, "__all__")) == {
        "TopologyRehearsalError",
        *TERMINAL_CLASSES,
        *PRECHECK_SPECIALISATIONS,
        "TERMINAL_ERRORS",
        "error_for",
        "resolve_outcome",
    }
