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

Do NOT make these pass by loosening a schema. The schemas are the contract.

POSITIVE CONTROLS
-----------------
``test_contract_schemas_are_well_formed`` and
``test_cross_file_refs_resolve_through_registry`` must PASS. Without them, a
harness fault (wrong path, unresolvable ``$ref``, unreadable schema) would
present identically to a genuine fixture divergence -- which is the same
can't-distinguish problem this file was written to fix.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

# jsonschema ships no inline types and types-jsonschema is not in the dev set.
# Targeted rather than a config-wide relaxation; mypy's warn_unused_ignores will
# flag this line if stubs are ever added, which is the cleanup signal.
from jsonschema import Draft202012Validator  # type: ignore[import-untyped]
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from .conftest import MOCK_CAPABILITIES, MOCK_RECEIPT

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
    "(x-cybrik-status: ACCEPTED FOR IMPLEMENTATION, v0.1.1). The fixture supplies 5 fields "
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
    "(x-cybrik-status: ACCEPTED FOR IMPLEMENTATION). The fixture overlaps the contract's 12 "
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


def _validator(filename: str) -> Draft202012Validator:
    """Build a validator for one contract schema with cross-file refs wired up."""
    return Draft202012Validator(_load_schema(filename), registry=_build_registry())


def _format_errors(validator: Draft202012Validator, instance: Any) -> str:
    """Render every validation error, so a failure names each divergence."""
    errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.absolute_path))
    return "\n".join(
        f"  - {'/'.join(str(p) for p in error.absolute_path) or '<root>'}: {error.message}"
        for error in errors
    )


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


# --------------------------------------------------------------------------
# Recorded divergences -- RED BY DESIGN. See module docstring.
# --------------------------------------------------------------------------


@pytest.mark.xfail(strict=True, reason=CAPABILITIES_XFAIL_REASON)
def test_mock_capabilities_conform_to_capability_contract() -> None:
    """Every MOCK_CAPABILITIES entry validates against the capability contract."""
    # Arrange
    validator = _validator(CAPABILITY_SCHEMA)

    # Act / Assert
    for index, capability in enumerate(MOCK_CAPABILITIES):
        errors = _format_errors(validator, capability)
        assert not errors, (
            f"MOCK_CAPABILITIES[{index}] ({capability.get('name', '<unnamed>')}) "
            f"violates {CAPABILITY_SCHEMA}:\n{errors}"
        )


@pytest.mark.xfail(strict=True, reason=RECEIPT_XFAIL_REASON)
def test_mock_receipt_conforms_to_execution_receipt_contract() -> None:
    """MOCK_RECEIPT validates against the execution receipt contract."""
    # Arrange
    validator = _validator(EXECUTION_RECEIPT_SCHEMA)

    # Act
    errors = _format_errors(validator, MOCK_RECEIPT)

    # Assert
    assert not errors, f"MOCK_RECEIPT violates {EXECUTION_RECEIPT_SCHEMA}:\n{errors}"
