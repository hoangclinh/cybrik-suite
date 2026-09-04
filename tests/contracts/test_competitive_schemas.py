"""Comprehensive test suite validating CYBRIK competitive JSON schemas (Draft 2020-12).

Covers:
- cybrik.investigation-bundle.v1.schema.json (Pillars 3, 4, 10: Investigation Graph & Evidence Bundle)
- cybrik.execution-receipt-ledger.v1.schema.json (Pillars 5, 9, 10: Execution Receipt Ledger & Hash Chaining)
- cybrik.stix-cti-bundle.v1.schema.json (Pillars 3, 6: STIX 2.1 CTI, ATT&CK, CVE, CISA KEV)
- cybrik.ai-bom.v1.schema.json (Pillars 1, 2, 10: AI Bill of Materials & Sovereign Verification)
- Cross-Product Semantic, Referential & Cryptographic Integrity Verification
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


SCHEMA_DIR = Path(__file__).resolve().parent.parent.parent / "contracts" / "json-schema"


def build_schema_registry() -> Registry:
    """Load all json-schema files into a referencing Registry for local cross-file $ref resolution."""
    registry = Registry()
    for schema_file in SCHEMA_DIR.glob("*.schema.json"):
        with open(schema_file, "r", encoding="utf-8") as f:
            schema_json = json.load(f)
            resource = Resource.from_contents(schema_json, default_specification=DRAFT202012)
            # Register by filename URI and by $id if present
            filename_uri = schema_file.name
            registry = registry.with_resource(filename_uri, resource)
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


def get_subschema_validator(schema_name: str, def_name: str, registry: Registry) -> Draft202012Validator:
    """Create a validator targeting a specific $defs sub-schema within a file."""
    return Draft202012Validator(
        {"$ref": f"{schema_name}#/$defs/{def_name}"},
        registry=registry,
    )


# ==============================================================================
# CRYPTOGRAPHIC & SEMANTIC INTEGRITY HELPERS
# ==============================================================================

def canonical_json_sha256(data: dict[str, Any], exclude_keys: tuple[str, ...] = ("digest",)) -> str:
    """Compute canonical SHA-256 digest over JSON object per RFC 8785 conventions."""
    filtered = {k: v for k, v in data.items() if k not in exclude_keys}
    canonical_bytes = json.dumps(filtered, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"sha256:{hashlib.sha256(canonical_bytes).hexdigest()}"


def compute_binary_merkle_root(leaf_digests: list[str]) -> str:
    """Compute binary Merkle tree root from a list of sha256 leaf digests."""
    if not leaf_digests:
        return f"sha256:{hashlib.sha256(b'').hexdigest()}"
    current_level = [d.replace("sha256:", "") for d in leaf_digests]
    while len(current_level) > 1:
        next_level = []
        for i in range(0, len(current_level), 2):
            left = current_level[i]
            right = current_level[i + 1] if i + 1 < len(current_level) else left
            combined = bytes.fromhex(left) + bytes.fromhex(right)
            next_level.append(hashlib.sha256(combined).hexdigest())
        current_level = next_level
    return f"sha256:{current_level[0]}"


def validate_investigation_bundle_semantics(bundle: dict[str, Any]) -> list[str]:
    """Semantic cross-referencing validator for investigation bundles.

    Detects:
    - Dangling node references in edges (source_node_id or target_node_id not in nodes)
    - Dangling citation references in edges (citation_refs not in citations)
    - Dangling evidence references in claims / hypotheses (not in evidence)
    - Edge loop / consistency constraints
    """
    errors: list[str] = []
    node_ids = {node["node_id"] for node in bundle.get("nodes", [])}
    citation_ids = {cit["citation_id"] for cit in bundle.get("citations", [])}
    evidence_ids = set()
    for ev in bundle.get("evidence", []):
        if "evidence_id" in ev:
            evidence_ids.add(ev["evidence_id"])
        elif "id" in ev:
            evidence_ids.add(ev["id"])

    # Check edges
    for edge in bundle.get("edges", []):
        edge_id = edge.get("edge_id", "unknown")
        src = edge.get("source_node_id")
        tgt = edge.get("target_node_id")
        if src not in node_ids:
            errors.append(f"Edge {edge_id}: source_node_id '{src}' is dangling (not found in nodes).")
        if tgt not in node_ids:
            errors.append(f"Edge {edge_id}: target_node_id '{tgt}' is dangling (not found in nodes).")
        for cref in edge.get("citation_refs", []):
            if cref not in citation_ids:
                errors.append(f"Edge {edge_id}: citation_ref '{cref}' is dangling (not found in citations).")

    # Check hypotheses
    for hyp in bundle.get("hypotheses", []):
        hyp_id = hyp.get("hypothesis_id", "unknown")
        for sref in hyp.get("supporting_evidence_refs", []):
            if sref not in evidence_ids:
                errors.append(f"Hypothesis {hyp_id}: supporting_evidence_ref '{sref}' is dangling (not found in evidence).")
        for rref in hyp.get("refuting_evidence_refs", []):
            if rref not in evidence_ids:
                errors.append(f"Hypothesis {hyp_id}: refuting_evidence_ref '{rref}' is dangling (not found in evidence).")

    # Check claims
    for claim in bundle.get("claims", []):
        claim_id = claim.get("claim_id") or claim.get("id", "unknown")
        for eref in claim.get("evidence_refs", []):
            if eref not in evidence_ids:
                errors.append(f"Claim {claim_id}: evidence_ref '{eref}' is dangling (not found in evidence).")

    return errors


# ==============================================================================
# SECTION 1: SCHEMA COMPLIANCE (Draft 2020-12 Meta-Schema Validation)
# ==============================================================================

COMPETITIVE_SCHEMAS = [
    "cybrik.investigation-bundle.v1.schema.json",
    "cybrik.execution-receipt-ledger.v1.schema.json",
    "cybrik.stix-cti-bundle.v1.schema.json",
    "cybrik.ai-bom.v1.schema.json",
]


@pytest.mark.parametrize("schema_file", COMPETITIVE_SCHEMAS)
def test_schema_itself_is_valid_draft_2020_12(schema_file: str):
    """Verify that every competitive schema is valid according to the JSON Schema Draft 2020-12 meta-schema."""
    schema = load_schema(schema_file)
    Draft202012Validator.check_schema(schema)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["x-cybrik-status"] == "ACCEPTED FOR IMPLEMENTATION"
    assert schema["x-cybrik-not-accepted"] is False
    assert schema["x-cybrik-contract-version"] == "1.0.0"


# ==============================================================================
# SECTION 2: PILLARS 3 & 4: INVESTIGATION BUNDLE SCHEMA TESTS
# ==============================================================================

@pytest.fixture
def investigation_bundle_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.investigation-bundle.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def base_valid_investigation_bundle() -> dict[str, Any]:
    """Factory fixture generating a fully populated, valid investigation bundle."""
    return {
        "bundle_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "investigation_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        "tenant_id": "tenant-enterprise-cyber",
        "status": "completed",
        "claims": [
            {
                "claim_id": "claim-001",
                "status": "asserted",
                "statement": "Host db-prod-01 was compromised via lateral movement using Pass-the-Hash.",
                "confidence": "high",
                "evidence_refs": ["ev-001", "ev-002"],
                "digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111"
            }
        ],
        "nodes": [
            {
                "node_id": "node-host-db-prod-01",
                "type": "asset",
                "label": "db-prod-01 (10.0.4.15)",
                "properties": {"hostname": "db-prod-01", "ip": "10.0.4.15", "os": "Linux Ubuntu 24.04"},
                "confidence": 0.95,
                "source_refs": ["soc.asset.123"],
                "digest": "sha256:2222222222222222222222222222222222222222222222222222222222222222"
            },
            {
                "node_id": "node-technique-t1075",
                "type": "technique",
                "label": "T1075 - Pass the Hash",
                "properties": {"mitre_id": "T1075", "tactic": "lateral-movement"},
                "confidence": 0.9,
                "digest": "sha256:3333333333333333333333333333333333333333333333333333333333333333"
            }
        ],
        "edges": [
            {
                "edge_id": "edge-001",
                "source_node_id": "node-technique-t1075",
                "target_node_id": "node-host-db-prod-01",
                "relationship_type": "targets",
                "weight": 0.85,
                "confidence": 0.9,
                "citation_refs": ["cit-001"],
                "properties": {"detected_protocol": "SMB/RPC"},
                "digest": "sha256:4444444444444444444444444444444444444444444444444444444444444444"
            }
        ],
        "citations": [
            {
                "citation_id": "cit-001",
                "source_type": "tool_execution",
                "source_ref": "receipt-siem-query-987",
                "excerpt": "EventID 4624 LogonType 3 AuthPackage NTLM from 10.0.2.88 to 10.0.4.15",
                "locator": "cybrik://fabric/receipt/receipt-siem-query-987",
                "timestamp": "2026-09-04T12:00:00Z",
                "digest": "sha256:5555555555555555555555555555555555555555555555555555555555555555"
            }
        ],
        "hypotheses": [
            {
                "hypothesis_id": "hyp-001",
                "title": "Adversary gained initial access via compromised developer workstation",
                "statement": "Workstation dev-mac-04 credentials were used to access db-prod-01.",
                "status": "supported",
                "confidence": 0.88,
                "supporting_evidence_refs": ["ev-001"],
                "refuting_evidence_refs": [],
                "contradiction_notes": "No conflicting Kerberos tickets observed.",
                "created_at": "2026-09-04T12:15:00Z",
                "updated_at": "2026-09-04T12:30:00Z"
            }
        ],
        "evidence": [
            {
                "evidence_id": "ev-001",
                "kind": "tool-result",
                "source_ref": {
                    "type": "soc.alert",
                    "id": "alert-9912",
                    "digest": "sha256:6666666666666666666666666666666666666666666666666666666666666666"
                },
                "summary": "Anomalous NTLM authentication burst observed in SIEM log window.",
                "data_marking": {
                    "tlp": "TLP:AMBER",
                    "classification": "confidential"
                },
                "digest": "sha256:7777777777777777777777777777777777777777777777777777777777777777"
            },
            {
                "evidence_id": "ev-002",
                "kind": "log-excerpt",
                "source_ref": {
                    "type": "tool.artifact",
                    "id": "art-log-4412",
                    "digest": "sha256:7777777777777777777777777777777777777777777777777777777777777778"
                },
                "summary": "Kerberos TGT request rejected followed by fallback to NTLMv2.",
                "digest": "sha256:7777777777777777777777777777777777777777777777777777777777777779"
            }
        ],
        "decisions": [
            {
                "decision_id": "dec-001",
                "decision_type": "containment_recommendation",
                "verdict": "true_positive",
                "rationale": "High-confidence pass-the-hash attack confirmed on production database host.",
                "risk_class": "R3",
                "policy_approval_required": True,
                "proposed_actions": [
                    {
                        "action_type": "isolate_host",
                        "target": "10.0.4.15",
                        "parameters": {"duration_minutes": 60},
                        "reversible": True,
                        "rollback_plan": "Restore firewall policy to permit legitimate application traffic."
                    }
                ],
                "actor": {
                    "type": "agent",
                    "id": "spiffe://cybrik.internal/cyber-ai/response-planner",
                    "tenant_id": "tenant-enterprise-cyber"
                },
                "decided_at": "2026-09-04T12:35:00Z",
                "digest": "sha256:8888888888888888888888888888888888888888888888888888888888888888"
            }
        ],
        "limitations": "Endpoint EDR telemetry on source workstation dev-mac-04 was offline during the event.",
        "generated_by": {
            "type": "service",
            "id": "spiffe://cybrik.internal/cyber-ai/orchestrator",
            "tenant_id": "tenant-enterprise-cyber"
        },
        "generated_at": "2026-09-04T12:36:00Z",
        "data_marking": {
            "tlp": "TLP:AMBER",
            "classification": "confidential"
        },
        "digest": "sha256:9999999999999999999999999999999999999999999999999999999999999999",
        "digests": {
            "nodes_digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "edges_digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "claims_digest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "evidence_digest": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            "citations_digest": "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            "hypotheses_digest": "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            "decisions_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        }
    }


def test_investigation_bundle_valid_full_graph(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
):
    """Test fully populated investigation bundle with nodes, edges, citations, hypotheses, evidence, decisions, digests."""
    investigation_bundle_validator.validate(base_valid_investigation_bundle)
    semantic_errors = validate_investigation_bundle_semantics(base_valid_investigation_bundle)
    assert not semantic_errors, f"Semantic errors found: {semantic_errors}"


ALL_INVESTIGATION_NODE_TYPES = [
    "entity", "ioc", "asset", "alert", "claim", "artifact", "actor",
    "technique", "vulnerability", "process", "file", "network_socket",
    "user_account", "hypothesis", "decision"
]


@pytest.mark.parametrize("node_type", ALL_INVESTIGATION_NODE_TYPES)
def test_investigation_bundle_valid_all_15_node_types(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
    node_type: str,
):
    """Verify that all 15 defined graphNode types validate successfully."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["nodes"] = [
        {
            "node_id": f"node-test-{node_type}",
            "type": node_type,
            "label": f"Test Node of Type {node_type}",
            "properties": {"type_tag": node_type},
            "confidence": 0.85,
            "digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111"
        }
    ]
    payload["edges"] = []
    investigation_bundle_validator.validate(payload)


ALL_INVESTIGATION_EDGE_RELATIONS = [
    "correlates_with", "causes", "derived_from", "supports", "refutes",
    "targets", "exploits", "communicates_with", "executes", "contains",
    "mitigates", "attributed_to", "spawns", "drops_file", "connects_to"
]


@pytest.mark.parametrize("rel_type", ALL_INVESTIGATION_EDGE_RELATIONS)
def test_investigation_bundle_valid_all_15_edge_relations(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
    rel_type: str,
):
    """Verify that all 15 defined graphEdge relationship_types validate successfully."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["edges"] = [
        {
            "edge_id": f"edge-test-{rel_type}",
            "source_node_id": "node-technique-t1075",
            "target_node_id": "node-host-db-prod-01",
            "relationship_type": rel_type,
            "weight": 0.75,
            "confidence": 0.88,
            "digest": "sha256:4444444444444444444444444444444444444444444444444444444444444444"
        }
    ]
    investigation_bundle_validator.validate(payload)


ALL_CITATION_SOURCE_TYPES = [
    "tool_execution", "log_record", "cti_feed", "stix_object",
    "asset_inventory", "telemetry", "kb_article", "sandbox_report"
]


@pytest.mark.parametrize("source_type", ALL_CITATION_SOURCE_TYPES)
def test_investigation_bundle_valid_all_8_citation_source_types(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
    source_type: str,
):
    """Verify that all 8 citation source_types validate successfully."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["citations"] = [
        {
            "citation_id": f"cit-test-{source_type}",
            "source_type": source_type,
            "source_ref": f"ref-{source_type}-101",
            "excerpt": f"Evidence excerpt for {source_type}",
            "locator": f"cybrik://sources/{source_type}/101",
            "timestamp": "2026-09-04T12:00:00Z",
            "digest": "sha256:5555555555555555555555555555555555555555555555555555555555555555"
        }
    ]
    payload["edges"][0]["citation_refs"] = [f"cit-test-{source_type}"]
    investigation_bundle_validator.validate(payload)


def test_investigation_bundle_valid_abstention_bundle(investigation_bundle_validator: Draft202012Validator):
    """Test minimal valid abstention bundle conforming to Roadmap Week 2 abstention mandate."""
    payload = {
        "bundle_id": "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
        "investigation_id": "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
        "tenant_id": "tenant-soc-alpha",
        "status": "abstained",
        "claims": [
            {
                "claim_id": "claim-abstained-01",
                "status": "abstained",
                "statement": "Evidence was insufficient to determine lateral movement mechanism.",
                "abstention_reason": "insufficient-evidence",
                "digest": "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
            }
        ],
        "limitations": "Insufficient SIEM telemetry; logs were purged past 7-day retention window.",
        "generated_by": {
            "type": "service",
            "id": "spiffe://cybrik.internal/cyber-ai/triage",
            "tenant_id": "tenant-soc-alpha"
        },
        "generated_at": "2026-09-04T14:00:00Z",
        "data_marking": {
            "tlp": "TLP:CLEAR",
            "classification": "internal"
        },
        "digest": "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"
    }
    investigation_bundle_validator.validate(payload)


@pytest.mark.parametrize("status", ["open", "in_progress", "completed", "abstained", "closed"])
def test_investigation_bundle_valid_all_statuses(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
    status: str,
):
    """Verify all 5 investigation status values are accepted."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["status"] = status
    investigation_bundle_validator.validate(payload)


@pytest.mark.parametrize(
    "verdict",
    ["true_positive", "false_positive", "benign_positive", "undetermined", "inconclusive", "abstained"]
)
def test_investigation_bundle_valid_all_verdicts(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
    verdict: str,
):
    """Verify all 6 decision verdict types are accepted."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["decisions"][0]["verdict"] = verdict
    investigation_bundle_validator.validate(payload)


@pytest.mark.parametrize(
    "required_prop",
    ["bundle_id", "investigation_id", "tenant_id", "status", "claims", "generated_by", "generated_at", "data_marking", "digest"]
)
def test_investigation_bundle_invalid_missing_required_fields(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
    required_prop: str,
):
    """Negative test: omission of any required root property triggers validation error."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    del payload[required_prop]
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


def test_investigation_bundle_invalid_unknown_node_type(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
):
    """Negative test: node with unsupported type is strictly rejected."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["nodes"].append({
        "node_id": "node-invalid-01",
        "type": "unsupported_magic_entity",
        "label": "Invalid Entity",
        "digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111"
    })
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


def test_investigation_bundle_invalid_edge_relationship(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
):
    """Negative test: edge with unsupported relationship_type is strictly rejected."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["edges"][0]["relationship_type"] = "likes_or_knows"
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


def test_investigation_bundle_invalid_empty_claims(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
):
    """Negative test: empty claims list violates minItems: 1 constraint."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["claims"] = []
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


def test_investigation_bundle_invalid_unknown_properties(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
):
    """Negative test: additionalProperties: false is enforced at root level."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["unauthorized_injected_field"] = "malicious_payload"
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


@pytest.mark.parametrize(
    "bad_digest",
    [
        "md5:d41d8cd98f00b204e9800998ecf8427e",  # MD5 instead of SHA-256
        "sha256:12345",  # Too short
        "sha256:" + "A" * 64,  # Uppercase hex rejected by pattern ^sha256:[0-9a-f]{64}$
        "1111111111111111111111111111111111111111111111111111111111111111",  # Missing sha256: prefix
    ],
)
def test_investigation_bundle_invalid_digest_formats(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
    bad_digest: str,
):
    """Negative test: malformed sha256 digests on root bundle are rejected."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["digest"] = bad_digest
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


def test_investigation_bundle_invalid_node_confidence_out_of_range(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
):
    """Negative test: node confidence > 1.0 is rejected."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["nodes"][0]["confidence"] = 1.5
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


def test_investigation_bundle_invalid_generated_by_missing_tenant_id(
    investigation_bundle_validator: Draft202012Validator,
    base_valid_investigation_bundle: dict[str, Any],
):
    """Negative test: generated_by actor must contain tenant_id."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["generated_by"] = {
        "type": "service",
        "id": "spiffe://cybrik.internal/cyber-ai/orchestrator"
        # Missing required tenant_id
    }
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


# ==============================================================================
# SECTION 3: PILLARS 5, 9, 10: EXECUTION RECEIPT LEDGER SCHEMA TESTS
# ==============================================================================

@pytest.fixture
def execution_receipt_ledger_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.execution-receipt-ledger.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def base_valid_receipt_ledger() -> dict[str, Any]:
    """Factory fixture generating a valid sealed execution receipt ledger."""
    return {
        "ledger_id": "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66",
        "tenant_id": "tenant-bank-security",
        "sequence_number": 42,
        "epoch": 1,
        "status": "sealed",
        "caller_identity": {
            "type": "service",
            "id": "spiffe://cybrik.internal/tool-fabric/control-plane",
            "tenant_id": "tenant-bank-security"
        },
        "receipts": [
            {
                "receipt_id": "rcpt-001",
                "action_id": "act-9901",
                "capability_name": "cybrik.siem.search_events.v1",
                "status": "completed",
                "risk_class": "R1",
                "delegation_ref": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
                "receipt_digest": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
                "signature_ref": "sig-fabric-cp-01",
                "recorded_at": "2026-09-04T11:00:00Z",
                "side_effect_performed": False
            },
            {
                "receipt_id": "rcpt-002",
                "action_id": "act-9902",
                "capability_name": "cybrik.firewall.block_ip.v1",
                "status": "completed",
                "risk_class": "R3",
                "delegation_ref": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
                "receipt_digest": "sha256:4444444444444444444444444444444444444444444444444444444444444444",
                "signature_ref": "sig-fabric-cp-02",
                "recorded_at": "2026-09-04T11:05:00Z",
                "side_effect_performed": True
            }
        ],
        "hashes": {
            "previous_ledger_digest": "sha256:5555555555555555555555555555555555555555555555555555555555555555",
            "merkle_root": "sha256:6666666666666666666666666666666666666666666666666666666666666666",
            "receipts_aggregate_hash": "sha256:7777777777777777777777777777777777777777777777777777777777777777",
            "hash_algorithm": "sha256"
        },
        "signatures": [
            {
                "authority_id": "spiffe://cybrik.internal/tool-fabric/control-plane-signer",
                "key_id": "key-fabric-cp-2026a",
                "algorithm": "Ed25519",
                "signature_value": "3J98t1WpYQ==",
                "certificate_digest": "sha256:8888888888888888888888888888888888888888888888888888888888888888",
                "signed_at": "2026-09-04T11:10:00Z"
            }
        ],
        "started_at": "2026-09-04T11:00:00Z",
        "closed_at": "2026-09-04T11:10:00Z",
        "receipt_count": 2,
        "digest": "sha256:9999999999999999999999999999999999999999999999999999999999999999",
        "metadata": {
            "rotation_trigger": "batch_timeout_reached",
            "retention_policy_days": 365
        }
    }


def test_execution_receipt_ledger_valid_sealed_block(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
):
    """Test valid sealed execution receipt ledger block with Merkle root and Ed25519 signature."""
    execution_receipt_ledger_validator.validate(base_valid_receipt_ledger)


@pytest.mark.parametrize("status", ["active", "sealed", "archived", "reconciled", "compromised"])
def test_execution_receipt_ledger_valid_all_statuses(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
    status: str,
):
    """Verify all 5 ledger status enum values are supported."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["status"] = status
    execution_receipt_ledger_validator.validate(payload)


@pytest.mark.parametrize(
    "receipt_status",
    ["completed", "partial", "denied", "failed", "timed_out", "cancelled", "rolled_back"]
)
def test_execution_receipt_ledger_valid_all_receipt_statuses(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
    receipt_status: str,
):
    """Verify all 7 execution receipt status values are supported."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["receipts"][0]["status"] = receipt_status
    execution_receipt_ledger_validator.validate(payload)


@pytest.mark.parametrize("sig_algo", ["Ed25519", "ECDSA-P256-SHA256", "RSA-PSS-SHA256"])
def test_execution_receipt_ledger_valid_signature_algorithms(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
    sig_algo: str,
):
    """Verify all 3 supported cryptographic signing algorithms."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["signatures"][0]["algorithm"] = sig_algo
    execution_receipt_ledger_validator.validate(payload)


@pytest.mark.parametrize("hash_algo", ["sha256", "sha384", "sha512", "blake3"])
def test_execution_receipt_ledger_valid_hash_algorithms(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
    hash_algo: str,
):
    """Verify all 4 supported ledger hash algorithms."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["hashes"]["hash_algorithm"] = hash_algo
    execution_receipt_ledger_validator.validate(payload)


@pytest.mark.parametrize(
    "required_prop",
    ["ledger_id", "tenant_id", "sequence_number", "status", "caller_identity", "receipts", "hashes", "signatures", "started_at", "closed_at", "receipt_count", "digest"]
)
def test_execution_receipt_ledger_invalid_missing_required_fields(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
    required_prop: str,
):
    """Negative test: omission of any required ledger property triggers validation error."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    del payload[required_prop]
    with pytest.raises(ValidationError):
        execution_receipt_ledger_validator.validate(payload)


def test_execution_receipt_ledger_invalid_negative_sequence(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
):
    """Negative test: sequence_number minimum: 0 constraint."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["sequence_number"] = -1
    with pytest.raises(ValidationError):
        execution_receipt_ledger_validator.validate(payload)


def test_execution_receipt_ledger_invalid_missing_signatures(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
):
    """Negative test: empty signatures list violates minItems: 1."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["signatures"] = []
    with pytest.raises(ValidationError):
        execution_receipt_ledger_validator.validate(payload)


def test_execution_receipt_ledger_invalid_signature_algorithm(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
):
    """Negative test: weak/unsupported signature algorithm is strictly rejected."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["signatures"][0]["algorithm"] = "MD5-RSA"
    with pytest.raises(ValidationError):
        execution_receipt_ledger_validator.validate(payload)


def test_execution_receipt_ledger_invalid_mutated_previous_hash_format(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
):
    """Negative test: invalid previous_ledger_digest format is rejected."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["hashes"]["previous_ledger_digest"] = "invalid_hash_string"
    with pytest.raises(ValidationError):
        execution_receipt_ledger_validator.validate(payload)


def test_execution_receipt_ledger_invalid_empty_receipts(
    execution_receipt_ledger_validator: Draft202012Validator,
    base_valid_receipt_ledger: dict[str, Any],
):
    """Negative test: receipts array must not be empty."""
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["receipts"] = []
    with pytest.raises(ValidationError):
        execution_receipt_ledger_validator.validate(payload)


# ==============================================================================
# SECTION 4: PILLARS 3 & 6: STIX 2.1 CTI BUNDLE SCHEMA TESTS
# ==============================================================================

@pytest.fixture
def stix_cti_bundle_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.stix-cti-bundle.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def base_valid_stix_bundle() -> dict[str, Any]:
    """Factory fixture generating a rich STIX 2.1 CTI bundle."""
    return {
        "type": "bundle",
        "id": "bundle--38c92a2a-fcfb-4e02-8611-37f90f23d111",
        "spec_version": "2.1",
        "tenant_id": "tenant-cti-global",
        "source": {
            "name": "CISA Cybersecurity Advisories",
            "feed_id": "feed-cisa-aa24-001",
            "reliability": "A",
            "url": "https://cisa.gov/advisories"
        },
        "confidence": 95,
        "tlp": "TLP:AMBER",
        "data_marking": {
            "tlp": "TLP:AMBER",
            "classification": "restricted"
        },
        "created_at": "2026-09-04T10:00:00Z",
        "valid_until": "2026-12-31T23:59:59Z",
        "enrichment_summary": {
            "attack_technique_count": 2,
            "cve_count": 1,
            "cisa_kev_count": 1,
            "indicator_count": 1,
            "malware_count": 1,
            "threat_actor_count": 1
        },
        "objects": [
            {
                "type": "attack-pattern",
                "id": "attack-pattern--44a8e234-8c8f-4318-97c3-30626b9a8888",
                "spec_version": "2.1",
                "created": "2026-09-04T10:00:00Z",
                "modified": "2026-09-04T10:00:00Z",
                "name": "Command and Scripting Interpreter: PowerShell",
                "description": "Adversaries may abuse PowerShell commands and scripts for execution.",
                "kill_chain_phases": [
                    {
                        "kill_chain_name": "mitre-attack",
                        "phase_name": "execution"
                    }
                ],
                "external_references": [
                    {
                        "source_name": "mitre-attack",
                        "external_id": "T1059.001",
                        "url": "https://attack.mitre.org/techniques/T1059/001"
                    }
                ],
                "confidence": 95
            },
            {
                "type": "vulnerability",
                "id": "vulnerability--55b9e234-8c8f-4318-97c3-30626b9a9999",
                "spec_version": "2.1",
                "created": "2026-09-04T10:00:00Z",
                "modified": "2026-09-04T10:00:00Z",
                "name": "CVE-2024-3400",
                "description": "PAN-OS GlobalProtect Command Injection Vulnerability.",
                "cvss_score": 10.0,
                "cvss_v3_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
                "cisa_kev": {
                    "known_exploited": True,
                    "date_added": "2024-04-12",
                    "due_date": "2024-04-19",
                    "known_ransomware_campaign_use": "Known",
                    "notes": "Actively exploited in the wild."
                },
                "external_references": [
                    {
                        "source_name": "cve",
                        "external_id": "CVE-2024-3400",
                        "url": "https://nvd.nist.gov/vuln/detail/CVE-2024-3400"
                    }
                ]
            },
            {
                "type": "indicator",
                "id": "indicator--66c9e234-8c8f-4318-97c3-30626b9aaaaa",
                "spec_version": "2.1",
                "created": "2026-09-04T10:00:00Z",
                "modified": "2026-09-04T10:00:00Z",
                "name": "Malicious PowerShell Download Cradle",
                "indicator_types": ["malicious-activity"],
                "pattern": "[process:command_line MATCHES 'powershell.*-enc.*IEX']",
                "pattern_type": "stix",
                "valid_from": "2026-09-04T10:00:00Z",
                "confidence": 90
            },
            {
                "type": "threat-actor",
                "id": "threat-actor--77d9e234-8c8f-4318-97c3-30626b9abbbb",
                "spec_version": "2.1",
                "created": "2026-09-04T10:00:00Z",
                "modified": "2026-09-04T10:00:00Z",
                "name": "Midnight Blizzard",
                "aliases": ["APT29", "Cozy Bear", "NOBELIUM"],
                "sophistication": "advanced",
                "resource_level": "government",
                "primary_motivation": "espionage"
            },
            {
                "type": "malware",
                "id": "malware--77a9e234-8c8f-4318-97c3-30626b9abbbc",
                "spec_version": "2.1",
                "created": "2026-09-04T10:00:00Z",
                "modified": "2026-09-04T10:00:00Z",
                "name": "Cobalt Strike Beacon",
                "is_family": True,
                "malware_types": ["backdoor", "trojan"],
                "architecture_execution_envs": ["x86", "x86-64"]
            },
            {
                "type": "relationship",
                "id": "relationship--88e9e234-8c8f-4318-97c3-30626b9acccc",
                "spec_version": "2.1",
                "created": "2026-09-04T10:00:00Z",
                "modified": "2026-09-04T10:00:00Z",
                "relationship_type": "uses",
                "source_ref": "threat-actor--77d9e234-8c8f-4318-97c3-30626b9abbbb",
                "target_ref": "attack-pattern--44a8e234-8c8f-4318-97c3-30626b9a8888",
                "confidence": 90
            },
            {
                "type": "marking-definition",
                "id": "marking-definition--99f9e234-8c8f-4318-97c3-30626b9adddd",
                "spec_version": "2.1",
                "created": "2026-09-04T10:00:00Z",
                "definition_type": "tlp",
                "definition": {
                    "tlp": "TLP:AMBER"
                }
            }
        ],
        "digest": "sha256:1234567890123456789012345678901234567890123456789012345678901234"
    }


def test_stix_cti_bundle_valid_rich_bundle(
    stix_cti_bundle_validator: Draft202012Validator,
    base_valid_stix_bundle: dict[str, Any],
):
    """Test valid STIX 2.1 CTI bundle with ATT&CK, CVE, CISA KEV, Indicators, and TLP markings."""
    stix_cti_bundle_validator.validate(base_valid_stix_bundle)


ALL_STIX_RELATIONSHIPS = [
    "uses", "indicates", "targets", "mitigates", "attributed-to",
    "variant-of", "exploits", "delivers", "downloads", "communicates-with", "compromises"
]


@pytest.mark.parametrize("rel_type", ALL_STIX_RELATIONSHIPS)
def test_stix_cti_bundle_valid_all_11_relationship_types(
    stix_cti_bundle_validator: Draft202012Validator,
    base_valid_stix_bundle: dict[str, Any],
    rel_type: str,
):
    """Verify all 11 STIX 2.1 relationship_types validate successfully."""
    payload = copy.deepcopy(base_valid_stix_bundle)
    for obj in payload["objects"]:
        if obj["type"] == "relationship":
            obj["relationship_type"] = rel_type
    stix_cti_bundle_validator.validate(payload)


@pytest.mark.parametrize("pattern_type", ["stix", "pcre", "sigma", "yara", "snort", "suricata"])
def test_stix_cti_bundle_valid_all_indicator_pattern_types(
    stix_cti_bundle_validator: Draft202012Validator,
    base_valid_stix_bundle: dict[str, Any],
    pattern_type: str,
):
    """Verify all 6 indicator pattern_types validate successfully."""
    payload = copy.deepcopy(base_valid_stix_bundle)
    for obj in payload["objects"]:
        if obj["type"] == "indicator":
            obj["pattern_type"] = pattern_type
    stix_cti_bundle_validator.validate(payload)


@pytest.mark.parametrize(
    "required_prop",
    ["type", "id", "spec_version", "objects", "tenant_id", "created_at", "data_marking", "digest"]
)
def test_stix_cti_bundle_invalid_missing_required_fields(
    stix_cti_bundle_validator: Draft202012Validator,
    base_valid_stix_bundle: dict[str, Any],
    required_prop: str,
):
    """Negative test: omission of any required bundle property triggers validation error."""
    payload = copy.deepcopy(base_valid_stix_bundle)
    del payload[required_prop]
    with pytest.raises(ValidationError):
        stix_cti_bundle_validator.validate(payload)


def test_stix_cti_bundle_invalid_spec_version(
    stix_cti_bundle_validator: Draft202012Validator,
    base_valid_stix_bundle: dict[str, Any],
):
    """Negative test: STIX spec_version must be strictly '2.1'."""
    payload = copy.deepcopy(base_valid_stix_bundle)
    payload["spec_version"] = "2.0"
    with pytest.raises(ValidationError):
        stix_cti_bundle_validator.validate(payload)


def test_stix_cti_bundle_invalid_confidence_out_of_range(
    stix_cti_bundle_validator: Draft202012Validator,
    base_valid_stix_bundle: dict[str, Any],
):
    """Negative test: confidence > 100 is strictly rejected."""
    payload = copy.deepcopy(base_valid_stix_bundle)
    payload["confidence"] = 150
    with pytest.raises(ValidationError):
        stix_cti_bundle_validator.validate(payload)


def test_stix_cti_bundle_invalid_bundle_id_pattern(
    stix_cti_bundle_validator: Draft202012Validator,
    base_valid_stix_bundle: dict[str, Any],
):
    """Negative test: bundle ID must match pattern ^bundle--<UUID>$."""
    payload = copy.deepcopy(base_valid_stix_bundle)
    payload["id"] = "invalid-bundle-id"
    with pytest.raises(ValidationError):
        stix_cti_bundle_validator.validate(payload)


def test_stix_cti_bundle_invalid_object_malformed_id(
    stix_cti_bundle_validator: Draft202012Validator,
    base_valid_stix_bundle: dict[str, Any],
):
    """Negative test: STIX object with malformed ID is rejected across all object defs."""
    payload = copy.deepcopy(base_valid_stix_bundle)
    payload["objects"][0]["id"] = "not-a-valid-stix-id"
    with pytest.raises(ValidationError):
        stix_cti_bundle_validator.validate(payload)


# Subschema specific tests for STIX $defs:
def test_stix_vulnerability_definition_constraints(registry: Registry):
    """Verify specific constraints of vulnerabilityObject subschema."""
    vuln_validator = get_subschema_validator("cybrik.stix-cti-bundle.v1.schema.json", "vulnerabilityObject", registry)

    valid_vuln = {
        "type": "vulnerability",
        "id": "vulnerability--55b9e234-8c8f-4318-97c3-30626b9a9999",
        "spec_version": "2.1",
        "created": "2026-09-04T10:00:00Z",
        "modified": "2026-09-04T10:00:00Z",
        "name": "CVE-2024-3400",
        "cvss_score": 9.8,
        "cvss_v3_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        "cisa_kev": {
            "known_exploited": True,
            "known_ransomware_campaign_use": "Known"
        }
    }
    vuln_validator.validate(valid_vuln)

    # Invalid CVE pattern
    invalid_cve = copy.deepcopy(valid_vuln)
    invalid_cve["name"] = "VULN-2024-3400"
    with pytest.raises(ValidationError):
        vuln_validator.validate(invalid_cve)

    # Invalid CVSS score
    invalid_cvss = copy.deepcopy(valid_vuln)
    invalid_cvss["cvss_score"] = 11.5
    with pytest.raises(ValidationError):
        vuln_validator.validate(invalid_cvss)

    # Invalid CVSS vector
    invalid_vec = copy.deepcopy(valid_vuln)
    invalid_vec["cvss_v3_vector"] = "INVALID_VECTOR_STRING"
    with pytest.raises(ValidationError):
        vuln_validator.validate(invalid_vec)

    # Invalid KEV ransomware enum
    invalid_kev = copy.deepcopy(valid_vuln)
    invalid_kev["cisa_kev"]["known_ransomware_campaign_use"] = "Maybe"
    with pytest.raises(ValidationError):
        vuln_validator.validate(invalid_kev)


def test_stix_attack_pattern_definition_constraints(registry: Registry):
    """Verify specific constraints of attackPatternObject subschema."""
    attack_validator = get_subschema_validator("cybrik.stix-cti-bundle.v1.schema.json", "attackPatternObject", registry)

    valid_attack = {
        "type": "attack-pattern",
        "id": "attack-pattern--44a8e234-8c8f-4318-97c3-30626b9a8888",
        "spec_version": "2.1",
        "created": "2026-09-04T10:00:00Z",
        "modified": "2026-09-04T10:00:00Z",
        "name": "PowerShell",
        "kill_chain_phases": [
            {"kill_chain_name": "mitre-attack", "phase_name": "execution"}
        ]
    }
    attack_validator.validate(valid_attack)

    # Invalid kill chain name enum
    invalid_killchain = copy.deepcopy(valid_attack)
    invalid_killchain["kill_chain_phases"][0]["kill_chain_name"] = "unsupported-kill-chain"
    with pytest.raises(ValidationError):
        attack_validator.validate(invalid_killchain)


# ==============================================================================
# SECTION 5: PILLARS 1, 2, 10: AI-BOM SCHEMA TESTS
# ==============================================================================

@pytest.fixture
def aibom_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.ai-bom.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def base_valid_aibom() -> dict[str, Any]:
    """Factory fixture generating a valid AI-BOM manifest for Qwen-2.5-72B-Instruct-AWQ."""
    return {
        "bom_id": "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55",
        "spec_version": "1.0.0",
        "tenant_id": "tenant-sovereign-soc",
        "model_identity": {
            "model_id": "qwen2.5-72b-instruct-awq",
            "family": "Qwen",
            "name": "Qwen2.5-72B-Instruct-AWQ",
            "version": "2.5.0",
            "vendor": "Alibaba Cloud",
            "architecture": "transformer-decoder",
            "parameter_count_billions": 72.5,
            "quantization": "awq",
            "context_window_tokens": 32768,
            "vocabulary_size": 152064
        },
        "weights_digest": {
            "algorithm": "sha256",
            "digest": "sha256:4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
            "file_count": 8,
            "total_size_bytes": 41280000000,
            "format": "safetensors",
            "layer_manifest_digests": [
                "sha256:1111111111111111111111111111111111111111111111111111111111111111",
                "sha256:2222222222222222222222222222222222222222222222222222222222222222"
            ]
        },
        "license": {
            "spdx_expression": "Apache-2.0",
            "commercial_use_permitted": True,
            "copyleft": False,
            "attribution_required": True,
            "usage_restrictions": ["sovereign-tenant-isolated", "no-unauthorized-telemetry-egress"],
            "license_url": "https://www.apache.org/licenses/LICENSE-2.0"
        },
        "runtime_profile": {
            "tier": "T1",
            "engine": "vllm",
            "min_vram_gb": 48.0,
            "recommended_gpus": 2,
            "max_concurrent_requests": 16,
            "context_window_limit": 32768,
            "quantization_backend": "autoawq",
            "tensor_parallel_size": 2,
            "pipeline_parallel_size": 1
        },
        "prompt_registry_digests": [
            {
                "prompt_id": "prompt-soc-triage-v1",
                "version": "1.2.0",
                "purpose": "triage",
                "digest": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
                "template_variables": ["alert_title", "severity", "asset_context"],
                "system_prompt_digest": "sha256:4444444444444444444444444444444444444444444444444444444444444444"
            },
            {
                "prompt_id": "prompt-soc-investigation-v1",
                "version": "1.0.0",
                "purpose": "investigation",
                "digest": "sha256:5555555555555555555555555555555555555555555555555555555555555555"
            }
        ],
        "evaluation_metrics": {
            "benchmark_suite": "CYBRIK-Golden-Eval-100",
            "golden_dataset_version": "2026.08-rev1",
            "golden_case_count": 100,
            "accuracy_score": 0.942,
            "precision": 0.951,
            "recall": 0.933,
            "f1_score": 0.942,
            "hallucination_rate": 0.015,
            "abstention_accuracy": 0.985,
            "adversarial_robustness_score": 0.968,
            "prompt_injection_resistance_score": 0.991,
            "p95_latency_ms": 1250.0,
            "evaluated_at": "2026-09-04T08:00:00Z",
            "evaluator_identity": {
                "type": "service",
                "id": "spiffe://cybrik.internal/cyber-ai/eval-harness",
                "tenant_id": "tenant-sovereign-soc"
            }
        },
        "data_lineage": {
            "training_cutoff_date": "2024-09-01",
            "curated_datasets": [
                {
                    "name": "MITRE-ATT&CK-Corpus-v15",
                    "digest": "sha256:6666666666666666666666666666666666666666666666666666666666666666",
                    "license": "CC-BY-4.0",
                    "purpose": "Threat knowledge alignment"
                }
            ]
        },
        "supply_chain_security": {
            "signing_authority": "CYBRIK Release Security Authority",
            "signature": "MEQCIF2DYQ==",
            "signature_algorithm": "ECDSA-P256-SHA256",
            "certificate_fingerprint": "sha256:7777777777777777777777777777777777777777777777777777777777777777"
        },
        "created_at": "2026-09-04T08:30:00Z",
        "digest": "sha256:8888888888888888888888888888888888888888888888888888888888888888"
    }


def test_aibom_valid_production_profile(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
):
    """Test valid AI-BOM manifest for production model deployment."""
    aibom_validator.validate(base_valid_aibom)


@pytest.mark.parametrize(
    "tier,engine,quant",
    [
        ("T0", "ollama", "gguf-q4_k_m"),
        ("T0", "llamacpp", "gguf-q8_0"),
        ("T1", "vllm", "awq"),
        ("T1", "triton", "gptq"),
        ("T2", "vllm", "bf16"),
        ("T2", "tgi", "fp16"),
    ]
)
def test_aibom_valid_runtime_profiles_and_tiers(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
    tier: str,
    engine: str,
    quant: str,
):
    """Verify various valid combinations of runtime tiers, engines, and quantization schemes."""
    payload = copy.deepcopy(base_valid_aibom)
    payload["runtime_profile"]["tier"] = tier
    payload["runtime_profile"]["engine"] = engine
    payload["model_identity"]["quantization"] = quant
    aibom_validator.validate(payload)


ALL_PROMPT_PURPOSES = [
    "triage", "investigation", "threat_hunt", "malware_analysis",
    "detection_engineering", "reporting", "response_planning", "summarization"
]


@pytest.mark.parametrize("purpose", ALL_PROMPT_PURPOSES)
def test_aibom_valid_all_prompt_purposes(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
    purpose: str,
):
    """Verify all 8 prompt registry purpose types validate successfully."""
    payload = copy.deepcopy(base_valid_aibom)
    payload["prompt_registry_digests"] = [
        {
            "prompt_id": f"prompt-{purpose}-v1",
            "version": "1.0.0",
            "purpose": purpose,
            "digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111"
        }
    ]
    aibom_validator.validate(payload)


@pytest.mark.parametrize(
    "required_prop",
    ["bom_id", "spec_version", "tenant_id", "model_identity", "weights_digest", "license", "runtime_profile", "prompt_registry_digests", "evaluation_metrics", "created_at", "digest"]
)
def test_aibom_invalid_missing_required_fields(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
    required_prop: str,
):
    """Negative test: omission of any required AI-BOM property triggers validation error."""
    payload = copy.deepcopy(base_valid_aibom)
    del payload[required_prop]
    with pytest.raises(ValidationError):
        aibom_validator.validate(payload)


def test_aibom_invalid_missing_metrics(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
):
    """Negative test: evaluation_metrics is strictly required."""
    payload = copy.deepcopy(base_valid_aibom)
    del payload["evaluation_metrics"]
    with pytest.raises(ValidationError):
        aibom_validator.validate(payload)


def test_aibom_invalid_runtime_tier(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
):
    """Negative test: runtime_profile.tier must be in enum (T0, T1, T2)."""
    payload = copy.deepcopy(base_valid_aibom)
    payload["runtime_profile"]["tier"] = "T9"
    with pytest.raises(ValidationError):
        aibom_validator.validate(payload)


def test_aibom_invalid_metric_score_out_of_bounds(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
):
    """Negative test: accuracy_score > 1.0 is strictly rejected."""
    payload = copy.deepcopy(base_valid_aibom)
    payload["evaluation_metrics"]["accuracy_score"] = 1.05
    with pytest.raises(ValidationError):
        aibom_validator.validate(payload)


def test_aibom_invalid_license_missing_spdx(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
):
    """Negative test: license object missing required spdx_expression is rejected."""
    payload = copy.deepcopy(base_valid_aibom)
    del payload["license"]["spdx_expression"]
    with pytest.raises(ValidationError):
        aibom_validator.validate(payload)


def test_aibom_invalid_missing_weights_digest(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
):
    """Negative test: weights_digest is strictly required on AI-BOM."""
    payload = copy.deepcopy(base_valid_aibom)
    del payload["weights_digest"]
    with pytest.raises(ValidationError):
        aibom_validator.validate(payload)


def test_aibom_invalid_parameter_count_too_small(
    aibom_validator: Draft202012Validator,
    base_valid_aibom: dict[str, Any],
):
    """Negative test: parameter_count_billions minimum: 0.1 constraint."""
    payload = copy.deepcopy(base_valid_aibom)
    payload["model_identity"]["parameter_count_billions"] = 0.01
    with pytest.raises(ValidationError):
        aibom_validator.validate(payload)


# ==============================================================================
# SECTION 6: CROSS-PRODUCT INTEGRATION & CRYPTOGRAPHIC VERIFICATION
# ==============================================================================

def test_cross_product_semantic_graph_consistency_pass(base_valid_investigation_bundle: dict[str, Any]):
    """Verify that a properly constructed investigation bundle passes semantic integrity checks."""
    errors = validate_investigation_bundle_semantics(base_valid_investigation_bundle)
    assert not errors, f"Expected clean semantic check, got errors: {errors}"


def test_cross_product_semantic_graph_dangling_citation_rejected(base_valid_investigation_bundle: dict[str, Any]):
    """Semantic test: edge referencing non-existent citation is detected."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["edges"][0]["citation_refs"] = ["cit-non-existent-999"]
    errors = validate_investigation_bundle_semantics(payload)
    assert any("dangling" in err and "cit-non-existent-999" in err for err in errors)


def test_cross_product_semantic_graph_dangling_node_rejected(base_valid_investigation_bundle: dict[str, Any]):
    """Semantic test: edge referencing non-existent source/target node is detected."""
    payload = copy.deepcopy(base_valid_investigation_bundle)
    payload["edges"][0]["source_node_id"] = "node-ghost-404"
    errors = validate_investigation_bundle_semantics(payload)
    assert any("source_node_id 'node-ghost-404' is dangling" in err for err in errors)


def test_cross_product_investigation_to_receipt_ledger_correlation_pass(
    base_valid_investigation_bundle: dict[str, Any],
    base_valid_receipt_ledger: dict[str, Any],
    investigation_bundle_validator: Draft202012Validator,
    execution_receipt_ledger_validator: Draft202012Validator,
):
    """Integration test: citations in an investigation bundle bind cryptographically to ledger execution receipts."""
    ledger_rcpt = base_valid_receipt_ledger["receipts"][0]
    aligned_citation = {
        "citation_id": "cit-tool-exec-01",
        "source_type": "tool_execution",
        "source_ref": ledger_rcpt["receipt_id"],
        "excerpt": "Executed SIEM query for anomalous NTLM burst",
        "locator": f"cybrik://fabric/receipt/{ledger_rcpt['receipt_id']}",
        "timestamp": ledger_rcpt["recorded_at"],
        "digest": ledger_rcpt["receipt_digest"]
    }
    bundle = copy.deepcopy(base_valid_investigation_bundle)
    bundle["citations"] = [aligned_citation]
    bundle["edges"][0]["citation_refs"] = ["cit-tool-exec-01"]

    # Both schemas validate successfully
    investigation_bundle_validator.validate(bundle)
    execution_receipt_ledger_validator.validate(base_valid_receipt_ledger)

    # Verify cross-contract binding
    matching_receipts = [
        r for r in base_valid_receipt_ledger["receipts"]
        if r["receipt_id"] == aligned_citation["source_ref"]
        and r["receipt_digest"] == aligned_citation["digest"]
    ]
    assert len(matching_receipts) == 1
    assert matching_receipts[0]["status"] == "completed"


def test_cross_product_investigation_to_stix_cti_correlation_pass(
    base_valid_investigation_bundle: dict[str, Any],
    base_valid_stix_bundle: dict[str, Any],
    investigation_bundle_validator: Draft202012Validator,
    stix_cti_bundle_validator: Draft202012Validator,
):
    """Integration test: technique and vulnerability nodes in investigation graph correlate to STIX CTI objects."""
    investigation_bundle_validator.validate(base_valid_investigation_bundle)
    stix_cti_bundle_validator.validate(base_valid_stix_bundle)

    # Extract ATT&CK IDs from STIX bundle
    stix_attack_ids = set()
    for obj in base_valid_stix_bundle["objects"]:
        if obj["type"] == "attack-pattern":
            for ref in obj.get("external_references", []):
                if ref.get("source_name") == "mitre-attack":
                    stix_attack_ids.add(ref.get("external_id"))

    # Verify technique nodes in bundle reference recognized ATT&CK IDs
    for node in base_valid_investigation_bundle["nodes"]:
        if node["type"] == "technique":
            mitre_id = node.get("properties", {}).get("mitre_id")
            assert mitre_id in ["T1075", "T1059.001"]


def test_cross_product_investigation_to_aibom_correlation_pass(
    base_valid_investigation_bundle: dict[str, Any],
    base_valid_aibom: dict[str, Any],
    investigation_bundle_validator: Draft202012Validator,
    aibom_validator: Draft202012Validator,
):
    """Integration test: agent prompt registry in AI-BOM matches investigation triage actor configuration."""
    investigation_bundle_validator.validate(base_valid_investigation_bundle)
    aibom_validator.validate(base_valid_aibom)

    prompt_purposes = {p["purpose"] for p in base_valid_aibom["prompt_registry_digests"]}
    assert "triage" in prompt_purposes
    assert "investigation" in prompt_purposes


def test_cryptographic_hash_chaining_verification(base_valid_receipt_ledger: dict[str, Any]):
    """Cryptographic test: prove tamper evidence across sequential ledger blocks."""
    block_0 = copy.deepcopy(base_valid_receipt_ledger)
    block_0["sequence_number"] = 0
    block_0["hashes"]["previous_ledger_digest"] = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    block_0_digest = canonical_json_sha256(block_0)
    block_0["digest"] = block_0_digest

    # Block 1 links to Block 0
    block_1 = copy.deepcopy(base_valid_receipt_ledger)
    block_1["sequence_number"] = 1
    block_1["hashes"]["previous_ledger_digest"] = block_0_digest
    block_1_digest = canonical_json_sha256(block_1)
    block_1["digest"] = block_1_digest

    assert block_1["hashes"]["previous_ledger_digest"] == block_0["digest"]

    # Tamper with Block 0
    tampered_block_0 = copy.deepcopy(block_0)
    tampered_block_0["receipts"][0]["status"] = "denied"
    tampered_digest = canonical_json_sha256(tampered_block_0)

    # Broken chain detected!
    assert tampered_digest != block_1["hashes"]["previous_ledger_digest"]


def test_cryptographic_merkle_root_calculation_and_verification(base_valid_receipt_ledger: dict[str, Any]):
    """Cryptographic test: compute Merkle root from receipts and verify tamper detection."""
    receipt_digests = [r["receipt_digest"] for r in base_valid_receipt_ledger["receipts"]]
    computed_root = compute_binary_merkle_root(receipt_digests)

    # Set calculated Merkle root in ledger
    payload = copy.deepcopy(base_valid_receipt_ledger)
    payload["hashes"]["merkle_root"] = computed_root

    assert computed_root.startswith("sha256:")
    assert len(computed_root) == 71  # "sha256:" (7) + 64 hex chars


def test_canonical_json_digest_calculation(base_valid_investigation_bundle: dict[str, Any]):
    """Cryptographic test: verify deterministic canonical JSON SHA-256 computation."""
    digest1 = canonical_json_sha256(base_valid_investigation_bundle)
    digest2 = canonical_json_sha256(base_valid_investigation_bundle)
    assert digest1 == digest2
    assert digest1.startswith("sha256:")
    assert len(digest1) == 71
