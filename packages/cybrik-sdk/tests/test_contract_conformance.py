"""Contract conformance checks for the SDK's own test fixtures.

WHY THIS FILE EXISTS
--------------------
``conftest.default_mock_router`` is a URL-matching fake responder whose branches
were authored from the *client* side: each branch exists because ``client.py``
calls that path. A green SDK suite therefore cannot distinguish "this endpoint is
implemented" from "this endpoint is planned", because the fixture was written to
match the client rather than the server.

These checks close that gap without requiring a live server, by validating the
fixture payloads against the JSON Schemas under ``contracts/json-schema/`` --
artifacts the server side owns and that carry
``x-cybrik-status: ACCEPTED FOR IMPLEMENTATION``.

TWO OF THESE CHECKS ARE RED BY DESIGN
-------------------------------------
``test_mock_capabilities_*`` and ``test_mock_receipt_*`` are expected failures.
They are not broken tests and they are not a broken candidate. Each carries the
exact contract reference for the divergence it records in its ``reason`` string.
They are marked ``strict=True`` deliberately: if a fixture is corrected, or a
schema moves such that the fixture starts conforming, the unexpected pass fails
the suite and forces someone to retire the xfail rather than let it rot.

They are also marked ``raises=ContractDivergenceError``, which only
``_assert_conforms`` raises, and only for a non-empty validation result. Any other
exception -- an unreadable schema, an unresolvable ``$ref``, a fault while
rendering errors, even a bare ``AssertionError`` -- is a harness fault, and fails
the test instead of being counted as the recorded divergence.

Do NOT make these pass by loosening a schema. The schemas are the contract.

FORMATS ARE ASSERTED
--------------------
The validator asserts ``format``, as the suite's own contract validator does
(ajv-formats). ``date-time`` is checked against RFC 3339 by a standard-library
checker in this file. jsonschema registers its own only when the optional
rfc3339-validator package is installed, and the SDK lock does not carry it.

POSITIVE CONTROLS
-----------------
All of these must PASS:

- ``test_contract_schemas_are_well_formed``
- ``test_cross_file_refs_resolve_through_registry``
- ``test_every_contract_ref_resolves_through_registry``
- ``test_non_conforming_instance_is_actually_rejected``
- ``test_conforming_receipt_is_accepted``
- ``test_divergence_raises_contract_divergence_error``
- ``test_malformed_receipt_timestamp_is_a_divergence``
- ``test_well_formed_rfc3339_timestamp_is_accepted``
- ``test_divergence_markers_fail_harness_faults``
- ``test_harness_fault_in_a_conformance_check_is_not_a_divergence``

Without them, a harness fault would be indistinguishable from a real result: a
wrong path, unresolvable ``$ref`` or unreadable schema would look like a fixture
divergence, and a validator permissive enough to accept anything would look
like a corrected fixture. That is the same can't-distinguish problem this file
was written to fix, so none of them may be removed in a cleanup.
"""

from __future__ import annotations

import calendar
import json
import re
import sys
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest

# jsonschema ships no inline types and types-jsonschema is not in the dev set.
# Targeted rather than a config-wide relaxation; mypy's warn_unused_ignores will
# flag this line if stubs are ever added, which is the cleanup signal.
from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from .conftest import MOCK_CAPABILITIES, MOCK_RECEIPT

# Ships with pytest itself. test_divergence_markers_fail_harness_faults runs an
# inner session so that pytest, not this file, classifies each outcome.
pytest_plugins = ["pytester"]

# <repo>/packages/cybrik-sdk/tests/ -> <repo>/
_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCHEMA_DIR = _REPO_ROOT / "contracts" / "json-schema"

CAPABILITY_SCHEMA = "cybrik.capability.v1.schema.json"
EXECUTION_RECEIPT_SCHEMA = "cybrik.execution-receipt.v1.schema.json"
COMMON_DEFS_SCHEMA = "cybrik.common-defs.v1.schema.json"

# Cross-file relative $ref the capability schema depends on. Resolving this is
# the narrow thing most likely to break the harness, so it gets its own check.
_RISK_CLASS_REF = f"{COMMON_DEFS_SCHEMA}#/$defs/riskClass"

CAPABILITIES_XFAIL_REASON = (
    "RED BY DESIGN -- recorded divergence, not a broken test. "
    "conftest.MOCK_CAPABILITIES does not conform to "
    "contracts/json-schema/cybrik.capability.v1.schema.json "
    "(x-cybrik-status: ACCEPTED FOR IMPLEMENTATION, v0.1.1). "
    "Status for this schema is established by "
    "contracts/compatibility/cybrik-suite-contract-packet.v1.manifest.json and its recorded "
    "sha256 7858dc758e078a0507096cfa742eb61a1cdf1531de89e76b48e1e22649cc6155, not by prose in "
    "any README. "
    "The fixture supplies 5 fields "
    "(name, action, risk_tier, description, reversible) against 16 required by the contract. "
    "It uses 'risk_tier' where the contract declares 'risk_class', and 'action'/'reversible' are "
    "not contract fields at all -- the schema is additionalProperties:false, so they are rejected "
    "outright. Note 'name' is present but still non-conforming: the contract requires a "
    "namespaced dotted form matching ^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$ (e.g. "
    "'vendor.isolate_host'), and the fixture's bare 'isolate_host' fails it. 'description' is "
    "therefore the only field in the fixture that actually conforms. "
    "GET /api/v1/capabilities is declared at "
    "contracts/openapi/cybrik-fabric-control-plane.v1.openapi.yaml (operationId: listCapabilities) "
    "but cybrik-security-tool-fabric does not serve it yet, so nothing has ever contradicted the "
    "fixture's shape. Resolve by correcting the fixture when fabric implements the contract. "
    "Do NOT resolve by loosening the schema."
)

RECEIPT_XFAIL_REASON = (
    "RED BY DESIGN -- recorded divergence, not a broken test. "
    "conftest.MOCK_RECEIPT does not conform to "
    "contracts/json-schema/cybrik.execution-receipt.v1.schema.json "
    "(x-cybrik-status: ACCEPTED FOR IMPLEMENTATION). "
    "Status for this schema is established by "
    "contracts/compatibility/cybrik-suite-contract-packet.v1.manifest.json and its recorded "
    "sha256 423ce118ae1ddabb0b3d1f13a65526e761356b9f14aa9974555976812cc0839d, not by prose in "
    "any README. "
    "The fixture overlaps the contract's 12 "
    "required fields on 4 (receipt_id, tenant_id, status, signature) and omits action_id, "
    "capability, executor, delegation_ref, resolved_arguments_digest, started_at, finished_at "
    "and receipt_digest. "
    "This is the more serious half of the divergence: the SDK models a direct "
    "execute_containment() against POST /api/v1/containment/execute, a path the contract does not "
    "declare. The contract's execution route is "
    "POST /api/v1/invocations -> GET /api/v1/receipts/{receipt_id} -> "
    "POST /api/v1/approvals/{approval_id}/decision -- an approval-gated, delegation-bound, "
    "digest-pinned flow. Those are different security models and the fixture currently ratifies "
    "the weaker one. "
    "Reshaping the client is deliberately OUT OF SCOPE here: it is an SDK public API change across "
    "a cross-repo contract boundary, against a contract that states it is v0.1.0 and not stable "
    "v1/GA. Revisit when fabric implements."
)


class ContractDivergenceError(AssertionError):
    """A fixture violates its contract: the one failure the xfails below accept.

    It subclasses ``AssertionError`` so an un-xfailed divergence still reads as a
    failed assertion. The restriction does not widen to the parent:
    ``xfail(raises=...)`` is an isinstance check, so a bare ``AssertionError``
    is not accepted, as test_divergence_markers_fail_harness_faults shows.
    """


CAPABILITIES_DIVERGENCE = pytest.mark.xfail(
    strict=True, raises=ContractDivergenceError, reason=CAPABILITIES_XFAIL_REASON
)
RECEIPT_DIVERGENCE = pytest.mark.xfail(
    strict=True, raises=ContractDivergenceError, reason=RECEIPT_XFAIL_REASON
)


def _digest(fill: str) -> str:
    """A syntactically valid ``sha256Digest`` built from one repeated hex digit."""
    return "sha256:" + fill * 64


# Every property the execution receipt contract declares, each with a conforming
# value. Validating it evaluates every $ref the receipt schema makes -- optional
# properties included, which a minimal receipt would never reach.
CONFORMING_RECEIPT: dict[str, Any] = {
    "receipt_id": "rcpt-control-0001",
    "action_id": "act-control-0001",
    "tenant_id": "tenant-control",
    "status": "completed",
    "capability": {"name": "vendor.isolate_host", "version": "1.2.3", "digest": _digest("1")},
    "executor": {
        "id": "spiffe://cybrik.example/executor/control",
        "version": "1.0.0",
        "isolation_profile": "S2",
    },
    "policy_decision_id": "pdec-control-0001",
    "approval_id": "appr-control-0001",
    "delegation_ref": _digest("2"),
    "credential_lease_id_hash": _digest("3"),
    "resolved_arguments_digest": _digest("4"),
    "started_at": "2026-10-02T06:28:31Z",
    "finished_at": "2026-10-02T06:28:32.250Z",
    "input_artifact_digests": [_digest("5")],
    "output_artifacts": [
        {
            "locator": "artifact://control/output-1",
            "digest": _digest("6"),
            "media_type": "application/json",
        }
    ],
    "side_effect": {
        "performed": True,
        "target_digest": _digest("7"),
        "verification": {},
        "expires_at": "2026-10-03T06:28:31Z",
        "rollback_handle": "rbh-control-0001",
    },
    "logs_digest": _digest("8"),
    "receipt_digest": _digest("9"),
    "signature": "control-signature-ref",
}

# Every receipt property typed timestampUtc (format: date-time), as a key path.
_RECEIPT_TIMESTAMP_FIELDS = (("started_at",), ("finished_at",), ("side_effect", "expires_at"))

# Each must fail as an RFC 3339 date-time. Python 3.12's datetime.fromisoformat
# accepts the first six, which is why the checker does not rely on it.
MALFORMED_DATE_TIMES = {
    "date-only": "2026-10-02",
    "no-offset": "2026-10-02T06:28:31",
    "space-separator": "2026-10-02 06:28:31Z",
    "offset-without-colon": "2026-10-02T06:28:31+0000",
    "no-seconds": "2026-10-02T06:28Z",
    "iso8601-basic-format": "20261002T062831Z",
    "impossible-day": "2026-02-30T06:28:31Z",
    "hour-24": "2026-10-02T24:00:00Z",
    "offset-hour-24": "2026-10-02T06:28:31+24:00",
    "leap-second-not-at-2359-utc": "2026-10-02T06:28:60Z",
    "non-ascii-digit": "2026-10-02T06:28:3\u0661Z",  # ARABIC-INDIC DIGIT ONE
    "trailing-newline": "2026-10-02T06:28:31Z\n",
    "not-a-timestamp": "not-a-timestamp",
}

# Each must pass, so the checker cannot invent a divergence. fromisoformat
# rejects the last three, though RFC 3339 section 5.6 allows them.
WELL_FORMED_DATE_TIMES = {
    "utc": "2026-10-02T06:28:31Z",
    "fractional-seconds": "2026-10-02T06:28:31.123456Z",
    "positive-offset": "2026-10-02T12:28:31+06:00",
    "negative-offset": "2026-10-02T01:28:31-05:00",
    "leap-day": "2024-02-29T00:00:00Z",
    "leap-second-utc": "2016-12-31T23:59:60Z",
    "leap-second-via-offset": "2016-12-31T18:59:60-05:00",
    "lower-case-t-and-z": "2026-10-02t06:28:31z",
}


def _read_json(path: Path) -> dict[str, Any]:
    """Parse one JSON document from disk."""
    document: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return document


def _load_schema(filename: str) -> dict[str, Any]:
    """Read one contract schema by filename, failing loudly if it is absent."""
    path = _SCHEMA_DIR / filename
    if not path.is_file():
        raise FileNotFoundError(
            f"Contract schema not found: {path}. "
            "These checks validate SDK fixtures against the suite's contract packet and "
            "require contracts/json-schema/ to be present. This is a hard failure rather "
            "than a skip on purpose -- a silent skip would reintroduce exactly the "
            "can't-distinguish problem this file exists to close."
        )
    return _read_json(path)


def _build_registry() -> Registry:
    """Register every contract schema under its own ``$id``.

    The schemas declare absolute ``$id`` values under
    ``https://contracts.cybrik.example/json-schema/`` and reference each other with
    relative filenames (e.g. ``cybrik.common-defs.v1.schema.json#/$defs/semver``).
    Registering by ``$id`` lets those relative refs resolve against the declared
    base without any network access -- the ``.example`` domain is RFC 2606 reserved
    and is an identifier, never an endpoint.
    """
    resources = []
    for path in sorted(_SCHEMA_DIR.glob("*.schema.json")):
        document = _read_json(path)
        resource = Resource.from_contents(document, default_specification=DRAFT202012)
        resources.append((document.get("$id", path.name), resource))
    return Registry().with_resources(resources)


# RFC 3339 section 5.6 ``date-time``: the production JSON Schema's ``date-time``
# format names, and the meaning of the contract's timestampUtc. This matches the
# structure only; calendar days and leap seconds are checked after the match.
# re.ASCII keeps \d to 0-9, and fullmatch, unlike ``$``, refuses a trailing newline.
_RFC3339_DATE_TIME = re.compile(
    r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})"
    r"[Tt]"
    r"(?P<hour>\d{2}):(?P<minute>\d{2}):(?P<second>\d{2})(?:\.\d+)?"
    r"(?:[Zz]|(?P<sign>[+-])(?P<offset_hour>\d{2}):(?P<offset_minute>\d{2}))",
    re.ASCII,
)
_MINUTES_PER_DAY = 24 * 60
_LEAP_SECOND_UTC_MINUTE = 23 * 60 + 59  # a leap second can only be 23:59:60 UTC


def _is_rfc3339_date_time(instance: object) -> bool:
    """Check RFC 3339 ``date-time`` with the standard library only.

    Requires the ``T`` separator, seconds, and an explicit ``Z`` or ``+hh:mm``
    or ``-hh:mm`` offset. ``datetime.fromisoformat`` does not require these, so
    it is not used. RFC 3339 section 5.6 allows lower-case ``t`` and ``z``, so
    they pass. A leap second (``:60``) passes only at 23:59 UTC.
    """
    if not isinstance(instance, str):
        return True  # format constrains strings only; "type" judges the rest
    match = _RFC3339_DATE_TIME.fullmatch(instance)
    if match is None:
        return False
    year, month, day = int(match["year"]), int(match["month"]), int(match["day"])
    hour, minute, second = int(match["hour"]), int(match["minute"]), int(match["second"])
    offset_hour, offset_minute = int(match["offset_hour"] or 0), int(match["offset_minute"] or 0)
    if not 1 <= month <= 12 or not 1 <= day <= calendar.monthrange(year, month)[1]:
        return False
    if hour > 23 or minute > 59 or second > 60 or offset_hour > 23 or offset_minute > 59:
        return False
    if second < 60:
        return True
    offset = (offset_hour * 60 + offset_minute) * (-1 if match["sign"] == "-" else 1)
    return (hour * 60 + minute - offset) % _MINUTES_PER_DAY == _LEAP_SECOND_UTC_MINUTE


def _format_checker() -> FormatChecker:
    """Return a new FormatChecker whose ``date-time`` check is RFC 3339.

    jsonschema registers ``date-time`` only when the optional rfc3339-validator
    package is importable. The SDK lock does not carry it, so the default
    checker would skip ``date-time`` silently. Registering on a new instance
    leaves jsonschema's shared default checker untouched.
    """
    checker = FormatChecker()
    checker.checks("date-time")(_is_rfc3339_date_time)
    return checker


def _validator(filename: str) -> Draft202012Validator:
    """Build a validator for one contract schema, with cross-file refs and formats wired up."""
    return Draft202012Validator(
        _load_schema(filename), registry=_build_registry(), format_checker=_format_checker()
    )


def _format_errors(validator: Draft202012Validator, instance: Any) -> str:
    """Render every validation error, so a failure names each divergence."""
    errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.absolute_path))
    return "\n".join(
        f"  - {'/'.join(str(p) for p in error.absolute_path) or '<root>'}: {error.message}"
        for error in errors
    )


def _assert_conforms(validator: Draft202012Validator, instance: Any, label: str) -> None:
    """Raise ContractDivergenceError naming every divergence, if there are any.

    Only a non-empty validation result raises it. An exception from validation
    or from rendering propagates unchanged, so the xfails cannot absorb it.
    """
    errors = _format_errors(validator, instance)
    if errors:
        raise ContractDivergenceError(f"{label}:\n{errors}")


def _iter_refs(node: Any) -> Iterator[str]:
    """Yield every ``$ref`` value in a schema document, depth first."""
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str):
            yield ref
        for value in node.values():
            yield from _iter_refs(value)
    elif isinstance(node, list):
        for item in node:
            yield from _iter_refs(item)


def _with_value(document: dict[str, Any], path: tuple[str, ...], value: Any) -> dict[str, Any]:
    """Return a copy of ``document`` with ``value`` at ``path``; the original is unchanged."""
    head, *rest = path
    replacement = _with_value(document[head], tuple(rest), value) if rest else value
    return {**document, head: replacement}


# --------------------------------------------------------------------------
# Positive controls -- these MUST pass, or the xfails below mean nothing.
# --------------------------------------------------------------------------


@pytest.mark.parametrize("filename", [CAPABILITY_SCHEMA, EXECUTION_RECEIPT_SCHEMA])
def test_contract_schemas_are_well_formed(filename: str) -> None:
    """Each contract schema is readable and is itself a valid 2020-12 schema."""
    # Arrange
    schema = _load_schema(filename)

    # Act / Assert -- raises SchemaError if the contract itself is malformed
    Draft202012Validator.check_schema(schema)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema.get("x-cybrik-status") == "ACCEPTED FOR IMPLEMENTATION"


def test_cross_file_refs_resolve_through_registry() -> None:
    """The registry resolves a relative cross-file $ref the capability schema uses.

    If this fails, every conformance result below is meaningless: an unresolvable
    ``$ref`` raises before any instance is ever checked against the contract.
    """
    # Arrange
    registry = _build_registry()
    capability_id = _load_schema(CAPABILITY_SCHEMA)["$id"]

    # Act
    resolved = registry.resolver(base_uri=capability_id).lookup(_RISK_CLASS_REF)

    # Assert
    assert isinstance(resolved.contents, dict)
    assert resolved.contents, f"{_RISK_CLASS_REF} resolved to an empty schema"


def test_non_conforming_instance_is_actually_rejected() -> None:
    """The validator rejects data the contract forbids.

    Guards against a validator wired so permissively that everything passes, which
    would make the xfails below pass for the wrong reason.
    """
    # Arrange
    validator = _validator(CAPABILITY_SCHEMA)

    # Act
    errors = list(validator.iter_errors({}))

    # Assert
    assert errors, "empty object was accepted against a schema with 16 required fields"


@pytest.mark.parametrize("filename", [CAPABILITY_SCHEMA, EXECUTION_RECEIPT_SCHEMA])
def test_every_contract_ref_resolves_through_registry(filename: str) -> None:
    """Every $ref each contract makes resolves, not only the capability's riskClass.

    The receipt's refs (tenantId, semver, sha256Digest, isolationProfile,
    timestampUtc) are its own, so the riskClass check above does not cover them.
    """
    # Arrange
    schema = _load_schema(filename)
    resolver = _build_registry().resolver(base_uri=schema["$id"])
    refs = sorted(set(_iter_refs(schema)))

    # Act -- lookup raises referencing.exceptions.Unresolvable on a dangling ref
    resolved = {ref: resolver.lookup(ref).contents for ref in refs}

    # Assert
    assert refs, f"{filename} declares no $ref, so this control would be vacuous"
    empty = [
        ref for ref, contents in resolved.items() if not isinstance(contents, dict) or not contents
    ]
    assert not empty, f"{filename}: refs resolved to an empty schema: {empty}"


def test_conforming_receipt_is_accepted() -> None:
    """A receipt that conforms in every declared property validates cleanly.

    The positive half of the receipt xfail: if a receipt ref resolved to the
    wrong definition, a conforming receipt would be rejected, and the fixture's
    expected failure would be red for the wrong reason.
    """
    # Arrange
    declared = set(_load_schema(EXECUTION_RECEIPT_SCHEMA)["properties"])
    validator = _validator(EXECUTION_RECEIPT_SCHEMA)

    # Act / Assert -- raises ContractDivergenceError naming each error otherwise
    assert set(CONFORMING_RECEIPT) == declared, "the control must populate every property"
    _assert_conforms(validator, CONFORMING_RECEIPT, "CONFORMING_RECEIPT")


def test_divergence_raises_contract_divergence_error() -> None:
    """A divergence raises the one type the xfails accept, naming the field."""
    # Arrange
    validator = _validator(EXECUTION_RECEIPT_SCHEMA)
    receipt = {key: value for key, value in CONFORMING_RECEIPT.items() if key != "action_id"}

    # Act / Assert -- exercises _format_errors on a real validation result
    with pytest.raises(ContractDivergenceError, match="'action_id' is a required property"):
        _assert_conforms(validator, receipt, "receipt without action_id")


@pytest.mark.parametrize("field", _RECEIPT_TIMESTAMP_FIELDS, ids="/".join)
@pytest.mark.parametrize(
    "value", list(MALFORMED_DATE_TIMES.values()), ids=list(MALFORMED_DATE_TIMES)
)
def test_malformed_receipt_timestamp_is_a_divergence(field: tuple[str, ...], value: str) -> None:
    """A malformed date-time is a divergence even when every other field conforms.

    Without format checking it was not, so a fixture with all 12 required fields
    and malformed timestamps would have retired the receipt xfail early.
    """
    # Arrange
    validator = _validator(EXECUTION_RECEIPT_SCHEMA)
    receipt = _with_value(CONFORMING_RECEIPT, field, value)

    # Act
    errors = [
        (tuple(error.absolute_path), error.validator) for error in validator.iter_errors(receipt)
    ]

    # Assert -- the only divergence is the format, at that field
    assert errors == [(field, "format")]
    with pytest.raises(ContractDivergenceError, match="is not a 'date-time'"):
        _assert_conforms(validator, receipt, "receipt with a malformed timestamp")


@pytest.mark.parametrize(
    "value", list(WELL_FORMED_DATE_TIMES.values()), ids=list(WELL_FORMED_DATE_TIMES)
)
def test_well_formed_rfc3339_timestamp_is_accepted(value: str) -> None:
    """A valid RFC 3339 date-time passes, so format checking cannot invent a divergence."""
    # Arrange
    validator = _validator(EXECUTION_RECEIPT_SCHEMA)
    receipt = _with_value(CONFORMING_RECEIPT, ("started_at",), value)

    # Act / Assert
    _assert_conforms(validator, receipt, f"receipt with started_at={value!r}")


# --------------------------------------------------------------------------
# Recorded divergences -- RED BY DESIGN. See module docstring.
# --------------------------------------------------------------------------


@CAPABILITIES_DIVERGENCE
def test_mock_capabilities_conform_to_capability_contract() -> None:
    """Every MOCK_CAPABILITIES entry validates against the capability contract."""
    # Arrange
    validator = _validator(CAPABILITY_SCHEMA)

    # Act / Assert
    for index, capability in enumerate(MOCK_CAPABILITIES):
        _assert_conforms(
            validator,
            capability,
            f"MOCK_CAPABILITIES[{index}] ({capability.get('name', '<unnamed>')}) "
            f"violates {CAPABILITY_SCHEMA}",
        )


@RECEIPT_DIVERGENCE
def test_mock_receipt_conforms_to_execution_receipt_contract() -> None:
    """MOCK_RECEIPT validates against the execution receipt contract."""
    # Arrange
    validator = _validator(EXECUTION_RECEIPT_SCHEMA)

    # Act / Assert
    _assert_conforms(validator, MOCK_RECEIPT, f"MOCK_RECEIPT violates {EXECUTION_RECEIPT_SCHEMA}")


# --------------------------------------------------------------------------
# Controls on the recorded divergences: they must fail for the right reason.
# --------------------------------------------------------------------------


@pytest.mark.parametrize("marker_name", ["CAPABILITIES_DIVERGENCE", "RECEIPT_DIVERGENCE"])
def test_divergence_markers_fail_harness_faults(
    pytester: pytest.Pytester, marker_name: str
) -> None:
    """Under the real marker, only ContractDivergenceError is an expected failure.

    An inner pytest session applies the marker object this module uses, so
    pytest itself classifies each outcome. A bare AssertionError is included
    because ContractDivergenceError subclasses it.
    """
    # Arrange
    pytester.makepyfile(
        f"""
        import sys

        from referencing.exceptions import Unresolvable

        conformance = sys.modules[{__name__!r}]
        divergence = conformance.{marker_name}

        @divergence
        def test_recorded_divergence():
            raise conformance.ContractDivergenceError("fixture violates its contract")

        @divergence
        def test_bare_assertion_error():
            raise AssertionError("a harness assert, not a contract divergence")

        @divergence
        def test_unresolvable_ref():
            raise Unresolvable("cybrik.common-defs.v1.schema.json#/$defs/missing")

        @divergence
        def test_unreadable_schema():
            raise FileNotFoundError("contracts/json-schema/missing.schema.json")

        @divergence
        def test_fault_while_rendering_errors():
            raise TypeError("'<' not supported between instances of 'int' and 'str'")

        @divergence
        def test_fixture_corrected():
            pass
        """
    )

    # Act -- the inner tests are synchronous, so pytest-asyncio is not loaded
    result = pytester.runpytest_inprocess("-p", "no:cacheprovider", "-p", "no:asyncio", "-rx")

    # Assert -- five failures, and the single expected failure is the divergence
    result.assert_outcomes(failed=5, xfailed=1)
    result.stdout.fnmatch_lines(["XFAIL *::test_recorded_divergence*"])


class _InjectedHarnessFault(Exception):
    """Stands in for any exception the conformance harness itself might raise."""


@pytest.mark.parametrize(
    "conformance_check",
    [
        test_mock_capabilities_conform_to_capability_contract,
        test_mock_receipt_conforms_to_execution_receipt_contract,
    ],
    ids=lambda check: check.__name__,
)
def test_harness_fault_in_a_conformance_check_is_not_a_divergence(
    monkeypatch: pytest.MonkeyPatch, conformance_check: Callable[[], None]
) -> None:
    """A fault inside the real conformance check propagates as itself.

    This is Codex Batch C's scenario: ``_format_errors`` raising. The fault must
    surface unchanged, never as the ContractDivergenceError the xfail accepts.
    """

    # Arrange
    def _faulty_format_errors(*_args: Any) -> str:
        raise _InjectedHarnessFault("injected fault in _format_errors")

    monkeypatch.setattr(sys.modules[__name__], "_format_errors", _faulty_format_errors)

    # Act / Assert
    with pytest.raises(_InjectedHarnessFault):
        conformance_check()
