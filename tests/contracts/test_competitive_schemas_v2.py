"""Comprehensive test suite validating CYBRIK competitive JSON schemas v2 (Draft 2020-12).

Covers:
- cybrik.sandbox-execution.v1.schema.json (Pillars 2, 5, 7, 10: Sandbox Execution, Isolation Tiers, Resource Limits, Decompression Bomb Guards, Receipts, Manifests)
- cybrik.rag-retrieval.v1.schema.json (Pillars 3, 4, 7, 10: RAG Retrieval, Dense/Sparse Search, RRF, TLP Filters, Clearance Bounds, Tenant Isolation, Scored Result Chunks)
- cybrik.taxii-feed.v1.schema.json (Pillars 3, 6, 7, 10: TAXII 2.1 Feed Collections, Polling Requests, Envelope Status, Clock Skew, Pagination Limits)
- Positive fixture conformance across all 3 contracts
- Adversarial & negative-schema test cases (CPU/memory ceilings, invalid TLP, negative pagination, missing fields)
- Negative-semantic control plane invariant checks
"""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCHEMA_DIR = REPO_ROOT / "contracts" / "json-schema"
EXAMPLES_DIR = REPO_ROOT / "contracts" / "examples"

COMPETITIVE_SCHEMAS_V2 = [
    "cybrik.sandbox-execution.v1.schema.json",
    "cybrik.rag-retrieval.v1.schema.json",
    "cybrik.taxii-feed.v1.schema.json",
]


def build_schema_registry() -> Registry:
    """Load all json-schema files into a referencing Registry for local cross-file $ref resolution."""
    registry = Registry()
    for schema_file in SCHEMA_DIR.glob("*.schema.json"):
        with open(schema_file, "r", encoding="utf-8") as f:
            schema_json = json.load(f)
            resource = Resource.from_contents(schema_json, default_specification=DRAFT202012)
            filename_uri = schema_file.name
            registry = registry.with_resource(filename_uri, resource)
            registry = registry.with_resource(f"https://schema.cybrik.io/contracts/{filename_uri}", resource)
            registry = registry.with_resource(f"https://schema.cybrik.io/v1/{filename_uri}", resource)
            registry = registry.with_resource(f"https://contracts.cybrik.example/json-schema/{filename_uri}", resource)
            if "$id" in schema_json:
                registry = registry.with_resource(schema_json["$id"], resource)
    return registry


@pytest.fixture(scope="session")
def registry() -> Registry:
    return build_schema_registry()


def load_schema(schema_name: str) -> dict[str, Any]:
    schema_path = SCHEMA_DIR / schema_name
    assert schema_path.exists(), f"Schema file {schema_name} does not exist at {schema_path}"
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_example(relative_path: str) -> dict[str, Any]:
    example_path = EXAMPLES_DIR / relative_path
    assert example_path.exists(), f"Example file does not exist at {example_path}"
    with open(example_path, "r", encoding="utf-8") as f:
        return json.load(f)


def canonical_json_sha256(data: dict[str, Any], exclude_keys: tuple[str, ...] = ("digest",)) -> str:
    """Compute canonical SHA-256 digest over JSON object."""
    filtered = {k: v for k, v in data.items() if k not in exclude_keys}
    canonical_bytes = json.dumps(filtered, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"sha256:{hashlib.sha256(canonical_bytes).hexdigest()}"


# ==============================================================================
# SECTION 1: DRAFT 2020-12 META-SCHEMA CONFORMANCE
# ==============================================================================

@pytest.mark.parametrize("schema_file", COMPETITIVE_SCHEMAS_V2)
def test_schema_valid_draft_2020_12(schema_file: str):
    """Verify each contract schema conforms strictly to Draft 2020-12 meta-schema."""
    schema = load_schema(schema_file)
    Draft202012Validator.check_schema(schema)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["$id"] == f"https://contracts.cybrik.example/json-schema/{schema_file}"
    assert schema["x-cybrik-status"] == "ACCEPTED FOR IMPLEMENTATION"
    assert schema["x-cybrik-not-accepted"] is False
    assert schema["x-cybrik-contract-version"] == "1.0.0"


# ==============================================================================
# SECTION 2: POSITIVE EXAMPLE VALIDATION ACROSS ALL 3 NEW CONTRACTS
# ==============================================================================

@pytest.fixture
def sandbox_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.sandbox-execution.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def rag_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.rag-retrieval.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def taxii_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.taxii-feed.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.mark.parametrize("example_file", [
    "sandbox/positive/sandbox-execution.s0-python-eval.json",
    "sandbox/positive/sandbox-execution.s1-malware-detonation.json",
    "sandbox/positive/sandbox-execution.s2-microvm-isolated.json",
])
def test_sandbox_positive_examples(sandbox_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(sandbox_validator.iter_errors(instance))
    assert not errors, f"Sandbox positive example {example_file} failed validation: {[e.message for e in errors]}"


@pytest.mark.parametrize("example_file", [
    "rag/positive/rag-retrieval.hybrid-cti-search.json",
    "rag/positive/rag-retrieval.dense-embedding-query.json",
    "rag/positive/rag-retrieval.scored-results-bundle.json",
])
def test_rag_positive_examples(rag_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(rag_validator.iter_errors(instance))
    assert not errors, f"RAG positive example {example_file} failed validation: {[e.message for e in errors]}"


@pytest.mark.parametrize("example_file", [
    "taxii/positive/taxii-feed.cisa-kev-collection.json",
    "taxii/positive/taxii-feed.misp-threat-indicators.json",
    "taxii/positive/taxii-feed.polling-envelope.json",
])
def test_taxii_positive_examples(taxii_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(taxii_validator.iter_errors(instance))
    assert not errors, f"TAXII positive example {example_file} failed validation: {[e.message for e in errors]}"


# ==============================================================================
# SECTION 3: ADVERSARIAL & NEGATIVE SCHEMA TEST CASES
# ==============================================================================

# --- SANDBOX ADVERSARIAL CASES ---

def test_sandbox_cpu_ceiling_exceeded(sandbox_validator: Draft202012Validator):
    """Adversarial case: Request exceeding maximum CPU core ceiling (e.g. 128 cores > 64 cores)."""
    instance = load_example("sandbox/positive/sandbox-execution.s0-python-eval.json")
    instance["resource_limits"]["cpu_cores"] = 128.0
    errors = list(sandbox_validator.iter_errors(instance))
    assert len(errors) > 0, "Expected validation error for CPU cores exceeding ceiling"
    assert any("maximum" in e.message.lower() or "128" in str(e.message) for e in errors)


def test_sandbox_memory_ceiling_exceeded(sandbox_validator: Draft202012Validator):
    """Adversarial case: Request exceeding maximum RAM ceiling (e.g. 131072 MB > 65536 MB)."""
    instance = load_example("sandbox/positive/sandbox-execution.s0-python-eval.json")
    instance["resource_limits"]["memory_mb"] = 131072
    errors = list(sandbox_validator.iter_errors(instance))
    assert len(errors) > 0, "Expected validation error for memory_mb exceeding ceiling"


def test_sandbox_negative_resource_limits(sandbox_validator: Draft202012Validator):
    """Adversarial case: Negative resource bounds (CPU, memory, timeout, output)."""
    instance = load_example("sandbox/positive/sandbox-execution.s0-python-eval.json")
    instance["resource_limits"]["cpu_cores"] = -2.0
    with pytest.raises(ValidationError):
        sandbox_validator.validate(instance)

    instance["resource_limits"]["cpu_cores"] = 1.0
    instance["resource_limits"]["memory_mb"] = -512
    with pytest.raises(ValidationError):
        sandbox_validator.validate(instance)

    instance["resource_limits"]["memory_mb"] = 512
    instance["resource_limits"]["wall_clock_timeout_seconds"] = 0
    with pytest.raises(ValidationError):
        sandbox_validator.validate(instance)


def test_sandbox_invalid_tier(sandbox_validator: Draft202012Validator):
    """Adversarial case: Non-existent sandbox tier (e.g. S99, S4)."""
    instance = load_example("sandbox/positive/sandbox-execution.s0-python-eval.json")
    instance["sandbox_tier"] = "S99"
    with pytest.raises(ValidationError):
        sandbox_validator.validate(instance)


def test_sandbox_decompression_bomb_ratio_exceeded(sandbox_validator: Draft202012Validator):
    """Adversarial case: Decompression bomb guard expansion ratio exceeding ceiling (e.g. 5000.0 > 1000.0)."""
    instance = load_example("sandbox/positive/sandbox-execution.s0-python-eval.json")
    instance["decompression_bomb_guard"]["max_ratio"] = 5000.0
    with pytest.raises(ValidationError):
        sandbox_validator.validate(instance)


def test_sandbox_decompression_bomb_max_size_exceeded(sandbox_validator: Draft202012Validator):
    """Adversarial case: Decompression uncompressed size exceeding ceiling (> 10GB)."""
    instance = load_example("sandbox/positive/sandbox-execution.s0-python-eval.json")
    instance["decompression_bomb_guard"]["max_uncompressed_bytes"] = 20 * 1024 * 1024 * 1024  # 20 GB
    with pytest.raises(ValidationError):
        sandbox_validator.validate(instance)


@pytest.mark.parametrize("required_field", [
    "execution_id",
    "tenant_id",
    "actor",
    "purpose",
    "sandbox_tier",
    "resource_limits",
    "decompression_bomb_guard",
    "data_marking",
    "created_at",
    "digest",
])
def test_sandbox_missing_required_fields(sandbox_validator: Draft202012Validator, required_field: str):
    """Adversarial case: Dropping mandatory top-level contract fields."""
    instance = load_example("sandbox/positive/sandbox-execution.s0-python-eval.json")
    del instance[required_field]
    with pytest.raises(ValidationError):
        sandbox_validator.validate(instance)


# --- RAG ADVERSARIAL CASES ---

def test_rag_invalid_tlp_marking(rag_validator: Draft202012Validator):
    """Adversarial case: Invalid TLP marking level."""
    instance = load_example("rag/positive/rag-retrieval.hybrid-cti-search.json")
    instance["access_control"]["tlp_marking_filter"] = ["TLP:PURPLE_ULTRA"]
    with pytest.raises(ValidationError):
        rag_validator.validate(instance)


def test_rag_missing_tenant_id(rag_validator: Draft202012Validator):
    """Adversarial case: Missing tenant_id violating tenant isolation boundaries."""
    instance = load_example("rag/positive/rag-retrieval.hybrid-cti-search.json")
    del instance["tenant_id"]
    with pytest.raises(ValidationError):
        rag_validator.validate(instance)


def test_rag_negative_rrf_constant(rag_validator: Draft202012Validator):
    """Adversarial case: Non-positive RRF k_constant (must be >= 1)."""
    instance = load_example("rag/positive/rag-retrieval.hybrid-cti-search.json")
    instance["search_parameters"]["rrf"]["k_constant"] = 0
    with pytest.raises(ValidationError):
        rag_validator.validate(instance)

    instance["search_parameters"]["rrf"]["k_constant"] = -10
    with pytest.raises(ValidationError):
        rag_validator.validate(instance)


def test_rag_invalid_similarity_metric(rag_validator: Draft202012Validator):
    """Adversarial case: Invalid similarity metric string."""
    instance = load_example("rag/positive/rag-retrieval.hybrid-cti-search.json")
    instance["search_parameters"]["dense"]["similarity_metric"] = "quantum_superposition"
    with pytest.raises(ValidationError):
        rag_validator.validate(instance)


def test_rag_missing_query_text(rag_validator: Draft202012Validator):
    """Adversarial case: Query object missing required text search string."""
    instance = load_example("rag/positive/rag-retrieval.hybrid-cti-search.json")
    del instance["query"]["text"]
    with pytest.raises(ValidationError):
        rag_validator.validate(instance)


@pytest.mark.parametrize("required_field", [
    "request_id",
    "tenant_id",
    "actor",
    "purpose",
    "query",
    "search_parameters",
    "access_control",
    "created_at",
    "digest",
])
def test_rag_missing_required_fields(rag_validator: Draft202012Validator, required_field: str):
    """Adversarial case: Dropping mandatory RAG contract fields."""
    instance = load_example("rag/positive/rag-retrieval.hybrid-cti-search.json")
    del instance[required_field]
    with pytest.raises(ValidationError):
        rag_validator.validate(instance)


# --- TAXII ADVERSARIAL CASES ---

def test_taxii_negative_pagination_limit(taxii_validator: Draft202012Validator):
    """Adversarial case: Negative or zero pagination limit."""
    instance = load_example("taxii/positive/taxii-feed.cisa-kev-collection.json")
    instance["polling_parameters"]["limit"] = -10
    with pytest.raises(ValidationError):
        taxii_validator.validate(instance)

    instance["polling_parameters"]["limit"] = 0
    with pytest.raises(ValidationError):
        taxii_validator.validate(instance)


def test_taxii_clock_skew_exceeded(taxii_validator: Draft202012Validator):
    """Adversarial case: Clock skew exceeding maximum allowed tolerance (300s)."""
    instance = load_example("taxii/positive/taxii-feed.cisa-kev-collection.json")
    instance["clock_skew_bounds"]["max_clock_skew_seconds"] = 1200
    with pytest.raises(ValidationError):
        taxii_validator.validate(instance)


def test_taxii_missing_collection_id(taxii_validator: Draft202012Validator):
    """Adversarial case: Collection missing mandatory UUID id."""
    instance = load_example("taxii/positive/taxii-feed.cisa-kev-collection.json")
    del instance["collection"]["id"]
    with pytest.raises(ValidationError):
        taxii_validator.validate(instance)


def test_taxii_invalid_envelope_status(taxii_validator: Draft202012Validator):
    """Adversarial case: Invalid envelope status token."""
    instance = load_example("taxii/positive/taxii-feed.cisa-kev-collection.json")
    instance["envelope_status"]["status"] = "in_transit_limbo"
    with pytest.raises(ValidationError):
        taxii_validator.validate(instance)


@pytest.mark.parametrize("required_field", [
    "feed_id",
    "tenant_id",
    "collection",
    "polling_parameters",
    "clock_skew_bounds",
    "envelope_status",
    "pagination",
    "data_marking",
    "created_at",
    "digest",
])
def test_taxii_missing_required_fields(taxii_validator: Draft202012Validator, required_field: str):
    """Adversarial case: Dropping mandatory TAXII contract fields."""
    instance = load_example("taxii/positive/taxii-feed.cisa-kev-collection.json")
    del instance[required_field]
    with pytest.raises(ValidationError):
        taxii_validator.validate(instance)


# ==============================================================================
# SECTION 4: NEGATIVE FIXTURE FILES CONFORMANCE
# ==============================================================================

@pytest.mark.parametrize("example_file", [
    "sandbox/negative-schema/sandbox-cpu-ceiling-exceeded.json",
    "sandbox/negative-schema/sandbox-memory-ceiling-exceeded.json",
    "sandbox/negative-schema/sandbox-invalid-tier.json",
    "sandbox/negative-schema/sandbox-decompression-bomb-ratio-exceeded.json",
    "sandbox/negative-schema/sandbox-missing-required-fields.json",
])
def test_sandbox_negative_schema_files(sandbox_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(sandbox_validator.iter_errors(instance))
    assert len(errors) > 0, f"Expected {example_file} to fail schema validation, but it passed!"


@pytest.mark.parametrize("example_file", [
    "rag/negative-schema/rag-invalid-tlp-marking.json",
    "rag/negative-schema/rag-missing-tenant-id.json",
    "rag/negative-schema/rag-negative-rrf-constant.json",
    "rag/negative-schema/rag-invalid-similarity-metric.json",
])
def test_rag_negative_schema_files(rag_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(rag_validator.iter_errors(instance))
    assert len(errors) > 0, f"Expected {example_file} to fail schema validation, but it passed!"


@pytest.mark.parametrize("example_file", [
    "taxii/negative-schema/taxii-negative-pagination-limit.json",
    "taxii/negative-schema/taxii-clock-skew-exceeded.json",
    "taxii/negative-schema/taxii-missing-collection-id.json",
    "taxii/negative-schema/taxii-invalid-envelope-status.json",
])
def test_taxii_negative_schema_files(taxii_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(taxii_validator.iter_errors(instance))
    assert len(errors) > 0, f"Expected {example_file} to fail schema validation, but it passed!"


# ==============================================================================
# SECTION 5: NEGATIVE SEMANTIC & CONTROL PLANE INVARIANT CHECKS
# ==============================================================================

def test_sandbox_negative_semantic_cross_tenant(sandbox_validator: Draft202012Validator):
    """Verify negative semantic sandbox fixture passes schema but fails cross-tenant check."""
    instance = load_example("sandbox/negative-semantic/sandbox-cross-tenant.json")
    sandbox_validator.validate(instance)  # structurally valid
    assert instance["tenant_id"] != instance["actor"]["tenant_id"]


def test_rag_negative_semantic_clearance(rag_validator: Draft202012Validator):
    """Verify negative semantic RAG fixture passes schema but fails clearance check."""
    instance = load_example("rag/negative-semantic/rag-clearance-exceeded.json")
    rag_validator.validate(instance)  # structurally valid
    # Semantic check: guest analyst should not have restricted clearance
    assert "guest" in instance["actor"]["id"]
    assert instance["access_control"]["classification_clearance_bound"] == "restricted"


def test_taxii_negative_semantic_cross_tenant(taxii_validator: Draft202012Validator):
    """Verify negative semantic TAXII fixture passes schema but fails cross-tenant poll."""
    instance = load_example("taxii/negative-semantic/taxii-cross-tenant-poll.json")
    taxii_validator.validate(instance)  # structurally valid
    assert instance["tenant_id"] == "tenant-globex-corp"
    assert "acme" in instance["collection"]["title"].lower()


# ==============================================================================
# SECTION 6: SUBSCHEMA & DEFINITIONS VALIDATION
# ==============================================================================

def get_subschema_validator(schema_name: str, def_name: str, registry: Registry) -> Draft202012Validator:
    """Create a validator targeting a specific $defs sub-schema within a file."""
    return Draft202012Validator(
        {"$ref": f"{schema_name}#/$defs/{def_name}"},
        registry=registry,
    )


def test_sandbox_tier_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.sandbox-execution.v1.schema.json", "sandboxTier", registry)
    validator.validate("S0")
    validator.validate("S1")
    validator.validate("S2")
    with pytest.raises(ValidationError):
        validator.validate("S3")
    with pytest.raises(ValidationError):
        validator.validate("S99")
    with pytest.raises(ValidationError):
        validator.validate(123)


def test_sandbox_resource_limits_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.sandbox-execution.v1.schema.json", "resourceLimits", registry)
    valid_limits = {
        "cpu_cores": 4.0,
        "memory_mb": 4096,
        "wall_clock_timeout_seconds": 120,
        "max_output_bytes": 1048576,
    }
    validator.validate(valid_limits)

    # Missing field
    with pytest.raises(ValidationError):
        validator.validate({"cpu_cores": 4.0, "memory_mb": 4096})

    # CPU ceiling exceeded
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_limits)
        bad["cpu_cores"] = 65.0
        validator.validate(bad)

    # Memory ceiling exceeded
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_limits)
        bad["memory_mb"] = 70000
        validator.validate(bad)


def test_sandbox_decompression_guard_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.sandbox-execution.v1.schema.json", "decompressionBombGuard", registry)
    valid_guard = {
        "max_ratio": 100.0,
        "max_uncompressed_bytes": 104857600,
    }
    validator.validate(valid_guard)

    # Ratio out of range
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_guard)
        bad["max_ratio"] = 0.5
        validator.validate(bad)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_guard)
        bad["max_ratio"] = 1500.0
        validator.validate(bad)


def test_rag_dense_parameters_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.rag-retrieval.v1.schema.json", "denseParameters", registry)
    valid_dense = {
        "enabled": True,
        "model_id": "bge-m3",
        "top_k": 50,
        "similarity_metric": "cosine",
        "score_threshold": 0.7,
    }
    validator.validate(valid_dense)

    # Invalid metric
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_dense)
        bad["similarity_metric"] = "invalid_metric"
        validator.validate(bad)

    # top_k out of range
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_dense)
        bad["top_k"] = 0
        validator.validate(bad)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_dense)
        bad["top_k"] = 501
        validator.validate(bad)


def test_rag_sparse_parameters_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.rag-retrieval.v1.schema.json", "sparseParameters", registry)
    valid_sparse = {
        "enabled": True,
        "algorithm": "bm25",
        "top_k": 25,
        "k1": 1.5,
        "b": 0.8,
    }
    validator.validate(valid_sparse)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_sparse)
        bad["algorithm"] = "unsupported_alg"
        validator.validate(bad)


def test_rag_rrf_parameters_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.rag-retrieval.v1.schema.json", "rrfParameters", registry)
    valid_rrf = {
        "enabled": True,
        "k_constant": 60,
        "top_k_final": 10,
    }
    validator.validate(valid_rrf)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_rrf)
        bad["k_constant"] = 0
        validator.validate(bad)


def test_taxii_collection_manifest_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.taxii-feed.v1.schema.json", "collectionManifest", registry)
    valid_coll = {
        "id": "528e2091-95fc-497d-82d9-1149e64e0a9b",
        "title": "CISA KEV Feed",
        "can_read": True,
        "can_write": False,
        "media_types": ["application/taxii+json;version=2.1"],
    }
    validator.validate(valid_coll)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_coll)
        bad["id"] = "not-a-uuid"
        validator.validate(bad)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_coll)
        bad["media_types"] = []
        validator.validate(bad)


def test_taxii_clock_skew_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.taxii-feed.v1.schema.json", "clockSkewBounds", registry)
    valid_skew = {
        "max_clock_skew_seconds": 60,
        "client_timestamp": "2026-09-04T20:00:00Z",
        "server_timestamp": "2026-09-04T20:00:02Z",
    }
    validator.validate(valid_skew)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_skew)
        bad["max_clock_skew_seconds"] = 301
        validator.validate(bad)
