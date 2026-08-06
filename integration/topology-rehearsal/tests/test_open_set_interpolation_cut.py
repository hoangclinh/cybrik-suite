"""The open set's remaining interpolation and read-boundary rows, cut at one mechanism.

Four rows carried by `VERDICT-c89761a` share a single shape: a value that arrived through an
injected port is touched — printed, named, hashed or iterated — outside every `try`, in a seam
whose callers are reducers contracted to *return* findings. The hostile object therefore
suppresses the report of its own divergence by refusing the operation that would describe it.

- F0006 (P2) — `observe`'s finding-returning reducers still interpolate raw `!r`.
- F0030 (P2) — `views` names a type raw at the two `not deeply immutable` findings.
- F0031 (P2) — `stored_entries` reads `.items()` and hashes the yielded key outside every `try`.
- F0034 (P3) — `preparation.frozen` names a type raw at four refusal sites.

Every test here is an escape test: it asserts that a hostile reading produces a *finding*, and
never an exception out of a seam contracted to return one.
"""

from types import MappingProxyType

import pytest

from cybrik_suite_topology_rehearsal.observe import (
    local_presence_findings,
    signed_identity_findings,
)
from cybrik_suite_topology_rehearsal.preparation import frozen
from cybrik_suite_topology_rehearsal.views import (
    immutability_findings,
    proved_copy,
    safe_type_name,
    stored_entries,
)

LABEL = "control"


class RaisingNameMeta(type):
    """A metaclass whose `__name__` refuses to be read."""

    @property
    def __name__(cls):
        raise RuntimeError("this type refuses to be named")


class HostileName(metaclass=RaisingNameMeta):
    """An ordinary mutable object whose *type* will not state its name."""


class HostileRepr:
    """A value that refuses to be printed."""

    def __repr__(self) -> str:
        raise RuntimeError("this value refuses to be represented")


class UnhashableKey:
    """A key that needs no hostile code at all: `__hash__ = None` is enough."""

    __hash__ = None

    def __repr__(self) -> str:
        return "<unhashable-key>"


class RaisingItems:
    """A mapping that refuses the one `.items()` read every judgement is taken from."""

    def keys(self):
        return ("a",)

    def __iter__(self):
        return iter(("a",))

    def __len__(self) -> int:
        return 1

    def __getitem__(self, key):
        return "v"

    def items(self):
        raise RuntimeError("this mapping refuses to be read")


class YieldsUnhashableKey:
    """A mapping whose one read yields a key that cannot be hashed."""

    def keys(self):
        return ()

    def __iter__(self):
        return iter(())

    def __len__(self) -> int:
        return 1

    def __getitem__(self, key):
        raise KeyError(key)

    def items(self):
        return ((UnhashableKey(), "v"),)


# --- F0030: naming a type is attacker-controlled code -------------------------------------


def test_safe_type_name_survives_a_refusing_name_descriptor():
    """The helper the two repaired sites rely on must itself never raise."""
    assert safe_type_name(HostileName()) == "<unnameable type>"


def test_immutability_findings_reports_a_type_that_refuses_to_be_named():
    """F0030: `:183` named the type raw, so the finding raised instead of being returned."""
    findings = immutability_findings(HostileName(), "grant")
    assert len(findings) == 1
    assert "not deeply immutable" in findings[0]
    assert "<unnameable type>" in findings[0]


def test_proved_copy_reports_a_type_that_refuses_to_be_named():
    """F0030: the same raw naming at `:797` escaped `proved_copy` as `RuntimeError`."""
    _copied, findings, _diverged = proved_copy(HostileName(), "grant", ())
    assert len(findings) == 1
    assert "<unnameable type>" in findings[0]


# --- F0031: the one `.items()` read and the yielded key's hash -----------------------------


def test_stored_entries_reports_a_mapping_that_refuses_its_items_read():
    """F0031: the read sat outside every `try`, so it escaped to unguarded callers."""
    stored, findings = stored_entries(RaisingItems(), LABEL)
    assert stored == {}
    assert len(findings) == 1
    assert "`.items()`" in findings[0]


def test_stored_entries_reports_a_yielded_key_that_refuses_to_be_hashed():
    """F0031: `stored[entry_key] = ...` hashed the key before `_is_stored` ever ran."""
    stored, findings = stored_entries(YieldsUnhashableKey(), LABEL)
    assert stored == {}
    assert any("refuses to be hashed" in finding for finding in findings)


def test_an_unhashable_yielded_key_does_not_forge_a_duplicate_collapse():
    """The repair must not pay for itself with a false 'collapsed silently' finding."""
    _stored, findings = stored_entries(YieldsUnhashableKey(), LABEL)
    assert not any("collapsed silently" in finding for finding in findings)


def test_signed_identity_findings_does_not_raise_on_an_unreadable_reading():
    """F0031's severity: `observe:336/339` call `stored_entries` outside every `try`."""
    result = signed_identity_findings(RaisingItems(), MappingProxyType({"present": True}))
    assert isinstance(result, tuple)
    assert result


# --- F0006: printing a value is attacker-controlled code -----------------------------------


def test_local_presence_findings_does_not_raise_on_a_value_that_refuses_repr():
    """F0006: the reducer interpolated the stored answer raw, so the report raised."""
    reading = MappingProxyType({"present": HostileRepr()})
    findings = local_presence_findings(reading, "image")
    assert len(findings) == 1
    assert "unrepresentable" in findings[0]


# --- F0034: `frozen` refuses with a named type ---------------------------------------------


def test_frozen_refuses_a_type_that_will_not_be_named_with_value_error():
    """F0034: raw naming turned the documented `ValueError` into `RuntimeError`."""
    with pytest.raises(ValueError, match="deeply immutable|dead copy"):
        frozen(HostileName())
