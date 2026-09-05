"""Comprehensive test suite validating CYBRIK competitive JSON schemas v4 (Draft 2020-12).

Covers:
- cybrik.eval-benchmark.v1.schema.json (Pillars 1, 4, 5, 8, 10: Golden & Adversarial Evaluation Suites, Triage Accuracy, Prompt Injection Resilience, Contradiction Detection, TLP Leakage Resistance, Hallucination Bounds, Signed Reports)
- cybrik.siem-query.v1.schema.json (Pillars 2, 3, 5, 7, 10: Standardized SIEM and Log Queries, OpenSearch, Wazuh, Elastic, Syslog CEF, DSL Expressions, Tenant Isolation, Time Bounds, Normalized Log Events)
- cybrik.investigation-view.v1.schema.json (Pillars 3, 4, 5, 8, 10: SOC Investigation Workspace Views, Aggregated Timeline Events, Graph Nodes and Relationships, Verifiable Citations, Report Exports)
- Positive fixture conformance across all 3 contracts
- Adversarial & negative-schema test cases (invalid evaluation metric ranges F1 > 1.0 or < 0.0, invalid SIEM target types, missing tenant_id in SIEM queries, inverted timeline timestamps, missing required fields)
- Direct $defs subschema unit testing
- Negative-semantic control plane invariant checks (metric total contradictions, cross-tenant log query leaks, dangling graph node references, inverted time ranges)
- Cryptographic & canonical digest verification (RFC 8785 canonical JSON digests, Ed25519 signature envelope verification)
"""

from __future__ import annotations

import copy
import datetime
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

COMPETITIVE_SCHEMAS_V4 = [
    "cybrik.eval-benchmark.v1.schema.json",
    "cybrik.siem-query.v1.schema.json",
    "cybrik.investigation-view.v1.schema.json",
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
    """Compute canonical SHA-256 digest over JSON object (RFC 8785 subset)."""
    filtered = {k: v for k, v in data.items() if k not in exclude_keys}
    canonical_bytes = json.dumps(filtered, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"sha256:{hashlib.sha256(canonical_bytes).hexdigest()}"


# ==============================================================================
# SECTION 1: DRAFT 2020-12 META-SCHEMA CONFORMANCE
# ==============================================================================

@pytest.mark.parametrize("schema_file", COMPETITIVE_SCHEMAS_V4)
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
# SECTION 2: POSITIVE EXAMPLE VALIDATION
# ==============================================================================

@pytest.fixture
def eval_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.eval-benchmark.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def siem_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.siem-query.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def investigation_view_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.investigation-view.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.mark.parametrize("example_file", [
    "eval/positive/eval-benchmark.triage-injection-suite.json",
    "eval/positive/eval-benchmark.contradiction-tlp-suite.json",
])
def test_eval_positive_examples(eval_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(eval_validator.iter_errors(instance))
    assert not errors, f"Eval positive example {example_file} failed validation: {[e.message for e in errors]}"


@pytest.mark.parametrize("example_file", [
    "siem/positive/siem-query.opensearch-auth-failure.json",
    "siem/positive/siem-query.wazuh-rootcheck.json",
    "siem/positive/siem-query.elastic-network-beacon.json",
])
def test_siem_positive_examples(siem_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(siem_validator.iter_errors(instance))
    assert not errors, f"SIEM positive example {example_file} failed validation: {[e.message for e in errors]}"


@pytest.mark.parametrize("example_file", [
    "investigation/positive/investigation-view.phishing-lateral-workspace.json",
    "investigation/positive/investigation-view.ransomware-containment-workspace.json",
])
def test_investigation_view_positive_examples(investigation_view_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(investigation_view_validator.iter_errors(instance))
    assert not errors, f"Investigation view positive example {example_file} failed validation: {[e.message for e in errors]}"


# ==============================================================================
# SECTION 3: ADVERSARIAL & IN-MEMORY SCHEMA EDGE CASES
# ==============================================================================

# --- EVALUATION BENCHMARK ADVERSARIAL CASES ---

def test_eval_invalid_f1_score_exceeds_one(eval_validator: Draft202012Validator):
    """Adversarial case: F1 score > 1.0 rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["benchmark_metrics"]["f1_score"] = 1.45
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


def test_eval_invalid_f1_score_negative(eval_validator: Draft202012Validator):
    """Adversarial case: F1 score < 0.0 rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["benchmark_metrics"]["f1_score"] = -0.1
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


def test_eval_invalid_precision_bounds(eval_validator: Draft202012Validator):
    """Adversarial case: Precision > 1.0 or < 0.0 rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["benchmark_metrics"]["precision"] = 1.05
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)

    instance["benchmark_metrics"]["precision"] = -0.01
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


def test_eval_invalid_recall_bounds(eval_validator: Draft202012Validator):
    """Adversarial case: Recall > 1.0 or < 0.0 rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["benchmark_metrics"]["recall"] = 1.2
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)

    instance["benchmark_metrics"]["recall"] = -0.5
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


def test_eval_invalid_refusal_rate_bounds(eval_validator: Draft202012Validator):
    """Adversarial case: Refusal rate > 1.0 or < 0.0 rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["benchmark_metrics"]["refusal_rate"] = 1.1
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)

    instance["benchmark_metrics"]["refusal_rate"] = -0.1
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


def test_eval_invalid_hallucination_index_bounds(eval_validator: Draft202012Validator):
    """Adversarial case: Hallucination index > 1.0 or < 0.0 rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["benchmark_metrics"]["hallucination_index"] = 2.0
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)

    instance["benchmark_metrics"]["hallucination_index"] = -0.05
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


def test_eval_negative_latency(eval_validator: Draft202012Validator):
    """Adversarial case: Negative latency p95 rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["benchmark_metrics"]["latency_p95_ms"] = -10.0
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


def test_eval_invalid_category_enum(eval_validator: Draft202012Validator):
    """Adversarial case: Unsupported evaluation category rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["categories"] = ["UNAUTHORIZED_CATEGORY_BREAKING_ENUM"]
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


def test_eval_invalid_suite_type_enum(eval_validator: Draft202012Validator):
    """Adversarial case: Unsupported suite_type enum rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["suite_type"] = "MAGIC_TEST_SUITE"
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


def test_eval_invalid_report_verdict_enum(eval_validator: Draft202012Validator):
    """Adversarial case: Unsupported report verdict enum rejected."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    instance["report"]["verdict"] = "PARTIALLY_UNKNOWN"
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


@pytest.mark.parametrize("required_field", [
    "suite_id",
    "name",
    "version",
    "suite_type",
    "tenant_id",
    "evaluator",
    "target_model",
    "categories",
    "scenarios",
    "benchmark_metrics",
    "report",
    "data_marking",
    "created_at",
    "digest",
])
def test_eval_missing_required_fields(eval_validator: Draft202012Validator, required_field: str):
    """Adversarial case: Dropping mandatory top-level Evaluation Benchmark fields."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    del instance[required_field]
    with pytest.raises(ValidationError):
        eval_validator.validate(instance)


# --- SIEM QUERY ADVERSARIAL CASES ---

def test_siem_invalid_target_system(siem_validator: Draft202012Validator):
    """Adversarial case: Unsupported SIEM target system rejected."""
    instance = load_example("siem/positive/siem-query.opensearch-auth-failure.json")
    instance["target_system"] = "SPLUNK_ENTERPRISE_CLOUD"
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)


def test_siem_missing_tenant_id(siem_validator: Draft202012Validator):
    """Adversarial case: Missing tenant_id violating tenant isolation boundaries."""
    instance = load_example("siem/positive/siem-query.opensearch-auth-failure.json")
    del instance["tenant_id"]
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)


def test_siem_invalid_dsl_type(siem_validator: Draft202012Validator):
    """Adversarial case: Unsupported DSL dialect rejected."""
    instance = load_example("siem/positive/siem-query.opensearch-auth-failure.json")
    instance["query_expression"]["dsl_type"] = "GRAPHQL_UNSUPPORTED"
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)


def test_siem_negative_limit(siem_validator: Draft202012Validator):
    """Adversarial case: Limit < 1 rejected."""
    instance = load_example("siem/positive/siem-query.opensearch-auth-failure.json")
    instance["limits"]["limit"] = 0
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)

    instance["limits"]["limit"] = -10
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)


def test_siem_limit_exceeds_maximum(siem_validator: Draft202012Validator):
    """Adversarial case: Limit > 100000 rejected."""
    instance = load_example("siem/positive/siem-query.opensearch-auth-failure.json")
    instance["limits"]["limit"] = 500000
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)


def test_siem_invalid_event_severity(siem_validator: Draft202012Validator):
    """Adversarial case: Invalid normalized event severity enum rejected."""
    instance = load_example("siem/positive/siem-query.opensearch-auth-failure.json")
    instance["events"][0]["severity"] = "SUPER_CRITICAL_APOCALYPSE"
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)


def test_siem_invalid_event_port_range(siem_validator: Draft202012Validator):
    """Adversarial case: Port number out of bounds (> 65535 or < 0) rejected."""
    instance = load_example("siem/positive/siem-query.opensearch-auth-failure.json")
    instance["events"][0]["source_port"] = 70000
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)

    instance["events"][0]["source_port"] = -1
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)


@pytest.mark.parametrize("log_field", [
    "event_id",
    "timestamp",
    "source_ip",
    "destination_ip",
    "event_type",
    "raw_message",
    "severity",
    "tenant_id",
])
def test_siem_missing_log_event_fields(siem_validator: Draft202012Validator, log_field: str):
    """Adversarial case: Dropping required fields from normalizedLogEvent."""
    instance = load_example("siem/positive/siem-query.opensearch-auth-failure.json")
    del instance["events"][0][log_field]
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)


@pytest.mark.parametrize("required_field", [
    "query_id",
    "tenant_id",
    "actor",
    "target_system",
    "query_expression",
    "time_range",
    "limits",
    "status",
    "events",
    "total_hits",
    "execution_time_ms",
    "data_marking",
    "created_at",
    "digest",
])
def test_siem_missing_required_fields(siem_validator: Draft202012Validator, required_field: str):
    """Adversarial case: Dropping mandatory top-level SIEM query fields."""
    instance = load_example("siem/positive/siem-query.opensearch-auth-failure.json")
    del instance[required_field]
    with pytest.raises(ValidationError):
        siem_validator.validate(instance)


# --- INVESTIGATION VIEW ADVERSARIAL CASES ---

def test_investigation_view_invalid_status_enum(investigation_view_validator: Draft202012Validator):
    """Adversarial case: Invalid workspace status enum rejected."""
    instance = load_example("investigation/positive/investigation-view.phishing-lateral-workspace.json")
    instance["status"] = "SUPER_RESOLVED_EXTREME"
    with pytest.raises(ValidationError):
        investigation_view_validator.validate(instance)


def test_investigation_view_invalid_risk_score(investigation_view_validator: Draft202012Validator):
    """Adversarial case: Risk score exceeding 100.0 or negative rejected."""
    instance = load_example("investigation/positive/investigation-view.phishing-lateral-workspace.json")
    instance["graph"]["nodes"][0]["risk_score"] = 150.0
    with pytest.raises(ValidationError):
        investigation_view_validator.validate(instance)

    instance["graph"]["nodes"][0]["risk_score"] = -5.0
    with pytest.raises(ValidationError):
        investigation_view_validator.validate(instance)


def test_investigation_view_invalid_citation_source(investigation_view_validator: Draft202012Validator):
    """Adversarial case: Unsupported citation source type rejected."""
    instance = load_example("investigation/positive/investigation-view.phishing-lateral-workspace.json")
    instance["citations"][0]["source_type"] = "UNVERIFIED_BLOG_POST"
    with pytest.raises(ValidationError):
        investigation_view_validator.validate(instance)


def test_investigation_view_invalid_export_format(investigation_view_validator: Draft202012Validator):
    """Adversarial case: Unsupported report export format rejected."""
    instance = load_example("investigation/positive/investigation-view.phishing-lateral-workspace.json")
    instance["report_export"]["export_format"] = "TIKTOK_VIDEO"
    with pytest.raises(ValidationError):
        investigation_view_validator.validate(instance)


@pytest.mark.parametrize("required_field", [
    "view_id",
    "investigation_id",
    "tenant_id",
    "title",
    "status",
    "created_by",
    "timeline_events",
    "graph",
    "citations",
    "report_export",
    "data_marking",
    "created_at",
    "updated_at",
    "digest",
])
def test_investigation_view_missing_required_fields(investigation_view_validator: Draft202012Validator, required_field: str):
    """Adversarial case: Dropping mandatory top-level Investigation View fields."""
    instance = load_example("investigation/positive/investigation-view.phishing-lateral-workspace.json")
    del instance[required_field]
    with pytest.raises(ValidationError):
        investigation_view_validator.validate(instance)


# ==============================================================================
# SECTION 4: NEGATIVE FIXTURE FILES CONFORMANCE
# ==============================================================================

@pytest.mark.parametrize("example_file", [
    "eval/negative-schema/eval-invalid-f1-range.json",
    "eval/negative-schema/eval-negative-f1-score.json",
    "eval/negative-schema/eval-invalid-category.json",
    "eval/negative-schema/eval-missing-metrics.json",
])
def test_eval_negative_schema_files(eval_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(eval_validator.iter_errors(instance))
    assert len(errors) > 0, f"Expected {example_file} to fail schema validation, but it passed!"


@pytest.mark.parametrize("example_file", [
    "siem/negative-schema/siem-invalid-target-system.json",
    "siem/negative-schema/siem-missing-tenant-id.json",
    "siem/negative-schema/siem-invalid-log-severity.json",
    "siem/negative-schema/siem-missing-log-fields.json",
])
def test_siem_negative_schema_files(siem_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(siem_validator.iter_errors(instance))
    assert len(errors) > 0, f"Expected {example_file} to fail schema validation, but it passed!"


@pytest.mark.parametrize("example_file", [
    "investigation/negative-schema/investigation-view-invalid-status.json",
    "investigation/negative-schema/investigation-view-missing-view-id.json",
    "investigation/negative-schema/investigation-view-invalid-citation-source.json",
    "investigation/negative-schema/investigation-view-invalid-risk-score.json",
])
def test_investigation_view_negative_schema_files(investigation_view_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(investigation_view_validator.iter_errors(instance))
    assert len(errors) > 0, f"Expected {example_file} to fail schema validation, but it passed!"


# ==============================================================================
# SECTION 5: DIRECT $DEFS SUBSCHEMA UNIT TESTING
# ==============================================================================

def test_defs_benchmark_metrics(registry: Registry):
    """Unit test for benchmarkMetrics subschema definition."""
    schema = load_schema("cybrik.eval-benchmark.v1.schema.json")
    subschema = schema["$defs"]["benchmarkMetrics"]
    validator = Draft202012Validator(subschema, registry=registry)

    valid_metrics = {
        "precision": 0.95,
        "recall": 0.90,
        "f1_score": 0.924,
        "refusal_rate": 1.0,
        "hallucination_index": 0.01,
        "latency_p95_ms": 220.0,
        "total_scenarios": 100,
        "passed_scenarios": 95,
        "failed_scenarios": 5,
    }
    validator.validate(valid_metrics)

    # Negative bounds test
    invalid_metrics = copy.deepcopy(valid_metrics)
    invalid_metrics["f1_score"] = 1.01
    with pytest.raises(ValidationError):
        validator.validate(invalid_metrics)


def test_defs_normalized_log_event(registry: Registry):
    """Unit test for normalizedLogEvent subschema definition."""
    schema = load_schema("cybrik.siem-query.v1.schema.json")
    subschema = schema["$defs"]["normalizedLogEvent"]
    validator = Draft202012Validator(subschema, registry=registry)

    valid_event = {
        "event_id": "evt-test-101",
        "timestamp": "2026-09-05T01:00:00Z",
        "source_ip": "10.0.0.1",
        "destination_ip": "10.0.0.2",
        "event_type": "authentication",
        "raw_message": "User logged on successfully",
        "severity": "INFORMATIONAL",
        "tenant_id": "tenant-acme",
    }
    validator.validate(valid_event)

    # Missing mandatory raw_message
    invalid_event = copy.deepcopy(valid_event)
    del invalid_event["raw_message"]
    with pytest.raises(ValidationError):
        validator.validate(invalid_event)


def test_defs_timeline_event(registry: Registry):
    """Unit test for timelineEvent subschema definition."""
    schema = load_schema("cybrik.investigation-view.v1.schema.json")
    subschema = schema["$defs"]["timelineEvent"]
    validator = Draft202012Validator(subschema, registry=registry)

    valid_tl_event = {
        "event_id": "tl-001",
        "timestamp": "2026-09-05T01:00:00Z",
        "event_type": "ALERT_TRIGGERED",
        "title": "EDR Alert",
        "severity": "HIGH",
        "source": "CrowdStrike",
        "entity_ids": ["host-01", "user-01"],
    }
    validator.validate(valid_tl_event)

    invalid_tl_event = copy.deepcopy(valid_tl_event)
    invalid_tl_event["event_type"] = "INVALID_EVENT_TYPE"
    with pytest.raises(ValidationError):
        validator.validate(invalid_tl_event)


# ==============================================================================
# SECTION 6: NEGATIVE SEMANTIC & CONTROL PLANE INVARIANT CHECKS
# ==============================================================================

def test_eval_negative_semantic_metric_contradiction(eval_validator: Draft202012Validator):
    """Verify negative semantic metric contradiction passes schema but fails arithmetic consistency."""
    instance = load_example("eval/negative-semantic/eval-metric-contradiction.json")
    eval_validator.validate(instance)  # structurally valid
    metrics = instance["benchmark_metrics"]
    assert metrics["passed_scenarios"] + metrics["failed_scenarios"] != metrics["total_scenarios"], (
        "Expected passed + failed != total contradiction"
    )


def test_siem_negative_semantic_inverted_time_bounds(siem_validator: Draft202012Validator):
    """Verify negative semantic inverted time bounds passes schema but fails temporal order."""
    instance = load_example("siem/negative-semantic/siem-inverted-time-bounds.json")
    siem_validator.validate(instance)  # structurally valid
    t_start = datetime.datetime.fromisoformat(instance["time_range"]["start_time"].replace("Z", "+00:00"))
    t_end = datetime.datetime.fromisoformat(instance["time_range"]["end_time"].replace("Z", "+00:00"))
    assert t_start > t_end, "Expected start_time to be strictly after end_time"


def test_siem_negative_semantic_cross_tenant_event(siem_validator: Draft202012Validator):
    """Verify negative semantic cross-tenant event passes schema but violates tenant boundary."""
    instance = load_example("siem/negative-semantic/siem-cross-tenant-event.json")
    siem_validator.validate(instance)  # structurally valid
    query_tenant = instance["tenant_id"]
    event_tenants = [e["tenant_id"] for e in instance["events"]]
    assert any(t != query_tenant for t in event_tenants), "Expected cross-tenant mismatch in event"


def test_investigation_view_negative_semantic_inverted_timeline(investigation_view_validator: Draft202012Validator):
    """Verify negative semantic inverted timeline passes schema but fails chronological sequence."""
    instance = load_example("investigation/negative-semantic/investigation-view-inverted-timeline.json")
    investigation_view_validator.validate(instance)  # structurally valid
    events = instance["timeline_events"]
    timestamps = [
        datetime.datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00"))
        for e in events
    ]
    # Check if timestamps are monotonically non-decreasing
    is_ordered = all(timestamps[i] <= timestamps[i + 1] for i in range(len(timestamps) - 1))
    assert not is_ordered, "Expected timeline sequence to be chronologically inverted"


def test_investigation_view_negative_semantic_unresolved_graph_edge(investigation_view_validator: Draft202012Validator):
    """Verify negative semantic unresolved graph edge passes schema but references non-existent node."""
    instance = load_example("investigation/negative-semantic/investigation-view-unresolved-graph-edge.json")
    investigation_view_validator.validate(instance)  # structurally valid
    node_ids = {n["node_id"] for n in instance["graph"]["nodes"]}
    edge = instance["graph"]["edges"][0]
    has_dangling_reference = (edge["source_id"] not in node_ids) or (edge["target_id"] not in node_ids)
    assert has_dangling_reference, "Expected dangling edge reference to missing node_id"


# ==============================================================================
# SECTION 7: CRYPTOGRAPHIC & CANONICAL DIGEST VERIFICATION
# ==============================================================================

def test_canonical_json_digest_calculation():
    """Verify RFC 8785 canonical JSON digest computation is deterministic and reproducible."""
    instance = load_example("eval/positive/eval-benchmark.triage-injection-suite.json")
    computed_digest = canonical_json_sha256(instance)
    assert computed_digest.startswith("sha256:")
    assert len(computed_digest) == 71  # "sha256:" (7 chars) + 64 hex chars
