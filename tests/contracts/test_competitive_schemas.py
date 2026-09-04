"""Comprehensive test suite validating CYBRIK competitive JSON schemas (Draft 2020-12).

Covers:
- cybrik.investigation-bundle.v1.schema.json (Pillars 3, 4, 10: Investigation Graph & Bundle)
- cybrik.stix-cti-bundle.v1.schema.json (Pillars 3, 6: STIX 2.1 CTI, ATT&CK, CVE, CISA KEV)
- cybrik.ai-bom.v1.schema.json (Pillars 1, 2, 10: AI Bill of Materials)
- cybrik.execution-receipt-ledger.v1.schema.json (Pillars 5, 9, 10: Execution Receipt Ledger)
"""

from __future__ import annotations

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


# ==============================================================================
# SCHEMA COMPLIANCE (Draft 2020-12 Meta-Schema Validation)
# ==============================================================================

@pytest.mark.parametrize(
    "schema_file",
    [
        "cybrik.investigation-bundle.v1.schema.json",
        "cybrik.stix-cti-bundle.v1.schema.json",
        "cybrik.ai-bom.v1.schema.json",
        "cybrik.execution-receipt-ledger.v1.schema.json",
    ],
)
def test_schema_itself_is_valid_draft_2020_12(schema_file: str):
    """Verify that every new schema is valid according to the JSON Schema Draft 2020-12 meta-schema."""
    schema = load_schema(schema_file)
    Draft202012Validator.check_schema(schema)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["x-cybrik-status"] == "ACCEPTED FOR IMPLEMENTATION"


# ==============================================================================
# PILLAR 3 & 4: INVESTIGATION BUNDLE SCHEMA TESTS
# ==============================================================================

@pytest.fixture
def investigation_bundle_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.investigation-bundle.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


def test_investigation_bundle_valid_full_graph(investigation_bundle_validator: Draft202012Validator):
    """Test fully populated investigation bundle with nodes, edges, citations, hypotheses, evidence, decisions, digests."""
    payload = {
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
                "type": "soc.claim",
                "id": "claim-abstained-01",
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


def test_investigation_bundle_invalid_empty_claims(investigation_bundle_validator: Draft202012Validator):
    """Verify that an investigation bundle with empty claims list is strictly rejected."""
    payload = {
        "bundle_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "investigation_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        "tenant_id": "tenant-enterprise-cyber",
        "status": "completed",
        "claims": [],  # MinItems: 1 constraint
        "generated_by": {
            "type": "service",
            "id": "spiffe://cybrik.internal/cyber-ai/orchestrator",
            "tenant_id": "tenant-enterprise-cyber"
        },
        "generated_at": "2026-09-04T12:36:00Z",
        "data_marking": {"tlp": "TLP:CLEAR", "classification": "internal"},
        "digest": "sha256:9999999999999999999999999999999999999999999999999999999999999999"
    }
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


def test_investigation_bundle_invalid_unknown_properties(investigation_bundle_validator: Draft202012Validator):
    """Verify additionalProperties: false is enforced."""
    payload = {
        "bundle_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "investigation_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        "tenant_id": "tenant-enterprise-cyber",
        "status": "completed",
        "claims": [
            {
                "type": "soc.claim",
                "id": "claim-01",
                "digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111"
            }
        ],
        "generated_by": {
            "type": "service",
            "id": "spiffe://cybrik.internal/cyber-ai/orchestrator",
            "tenant_id": "tenant-enterprise-cyber"
        },
        "generated_at": "2026-09-04T12:36:00Z",
        "data_marking": {"tlp": "TLP:CLEAR", "classification": "internal"},
        "digest": "sha256:9999999999999999999999999999999999999999999999999999999999999999",
        "unauthorized_secret_field": "disallowed"
    }
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


def test_investigation_bundle_invalid_edge_relationship(investigation_bundle_validator: Draft202012Validator):
    """Verify graphEdge relationship_type enum constraint."""
    payload = {
        "bundle_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "investigation_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        "tenant_id": "tenant-enterprise-cyber",
        "status": "completed",
        "claims": [
            {
                "type": "soc.claim",
                "id": "claim-01",
                "digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111"
            }
        ],
        "edges": [
            {
                "edge_id": "edge-001",
                "source_node_id": "node-1",
                "target_node_id": "node-2",
                "relationship_type": "invalid_unsupported_relation",  # Invalid enum
                "digest": "sha256:4444444444444444444444444444444444444444444444444444444444444444"
            }
        ],
        "generated_by": {
            "type": "service",
            "id": "spiffe://cybrik.internal/cyber-ai/orchestrator",
            "tenant_id": "tenant-enterprise-cyber"
        },
        "generated_at": "2026-09-04T12:36:00Z",
        "data_marking": {"tlp": "TLP:CLEAR", "classification": "internal"},
        "digest": "sha256:9999999999999999999999999999999999999999999999999999999999999999"
    }
    with pytest.raises(ValidationError):
        investigation_bundle_validator.validate(payload)


# ==============================================================================
# PILLAR 3: STIX 2.1 CTI BUNDLE SCHEMA TESTS
# ==============================================================================

@pytest.fixture
def stix_cti_bundle_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.stix-cti-bundle.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


def test_stix_cti_bundle_valid_rich_bundle(stix_cti_bundle_validator: Draft202012Validator):
    """Test valid STIX 2.1 CTI bundle with ATT&CK, CVE, CISA KEV, Indicators, and TLP markings."""
    payload = {
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
    stix_cti_bundle_validator.validate(payload)


def test_stix_cti_bundle_invalid_spec_version(stix_cti_bundle_validator: Draft202012Validator):
    """Verify STIX spec_version must be '2.1'."""
    payload = {
        "type": "bundle",
        "id": "bundle--38c92a2a-fcfb-4e02-8611-37f90f23d111",
        "spec_version": "2.0",  # Invalid, must be "2.1"
        "tenant_id": "tenant-cti",
        "created_at": "2026-09-04T10:00:00Z",
        "data_marking": {"tlp": "TLP:CLEAR", "classification": "public"},
        "objects": [
            {
                "type": "indicator",
                "id": "indicator--66c9e234-8c8f-4318-97c3-30626b9aaaaa",
                "spec_version": "2.1",
                "created": "2026-09-04T10:00:00Z",
                "modified": "2026-09-04T10:00:00Z",
                "pattern": "[file:hashes.MD5 = 'd41d8cd98f00b204e9800998ecf8427e']",
                "pattern_type": "stix",
                "valid_from": "2026-09-04T10:00:00Z"
            }
        ],
        "digest": "sha256:1234567890123456789012345678901234567890123456789012345678901234"
    }
    with pytest.raises(ValidationError):
        stix_cti_bundle_validator.validate(payload)


def test_stix_cti_bundle_invalid_confidence_out_of_range(stix_cti_bundle_validator: Draft202012Validator):
    """Verify confidence score maximum: 100 is strictly enforced."""
    payload = {
        "type": "bundle",
        "id": "bundle--38c92a2a-fcfb-4e02-8611-37f90f23d111",
        "spec_version": "2.1",
        "tenant_id": "tenant-cti",
        "confidence": 150,  # Invalid, max is 100
        "created_at": "2026-09-04T10:00:00Z",
        "data_marking": {"tlp": "TLP:CLEAR", "classification": "public"},
        "objects": [
            {
                "type": "indicator",
                "id": "indicator--66c9e234-8c8f-4318-97c3-30626b9aaaaa",
                "spec_version": "2.1",
                "created": "2026-09-04T10:00:00Z",
                "modified": "2026-09-04T10:00:00Z",
                "pattern": "[file:hashes.MD5 = 'd41d8cd98f00b204e9800998ecf8427e']",
                "pattern_type": "stix",
                "valid_from": "2026-09-04T10:00:00Z"
            }
        ],
        "digest": "sha256:1234567890123456789012345678901234567890123456789012345678901234"
    }
    with pytest.raises(ValidationError):
        stix_cti_bundle_validator.validate(payload)


# ==============================================================================
# PILLAR 1 & 10: AI-BOM SCHEMA TESTS
# ==============================================================================

@pytest.fixture
def aibom_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.ai-bom.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


def test_aibom_valid_production_profile(aibom_validator: Draft202012Validator):
    """Test valid AI-BOM manifest for Qwen-2.5-72B-Instruct-AWQ production deployment."""
    payload = {
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
            "signature": "MEQCIF2D...base64...",
            "signature_algorithm": "ECDSA-P256-SHA256",
            "certificate_fingerprint": "sha256:7777777777777777777777777777777777777777777777777777777777777777"
        },
        "created_at": "2026-09-04T08:30:00Z",
        "digest": "sha256:8888888888888888888888888888888888888888888888888888888888888888"
    }
    aibom_validator.validate(payload)


def test_aibom_invalid_missing_metrics(aibom_validator: Draft202012Validator):
    """Verify evaluation_metrics is required."""
    payload = {
        "bom_id": "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55",
        "spec_version": "1.0.0",
        "tenant_id": "tenant-sovereign-soc",
        "model_identity": {
            "model_id": "qwen2.5-72b-instruct-awq",
            "family": "Qwen",
            "name": "Qwen2.5-72B-Instruct-AWQ",
            "version": "2.5.0",
            "architecture": "transformer-decoder",
            "parameter_count_billions": 72.5,
            "quantization": "awq"
        },
        "weights_digest": {
            "algorithm": "sha256",
            "digest": "sha256:4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
            "file_count": 8,
            "total_size_bytes": 41280000000
        },
        "license": {
            "spdx_expression": "Apache-2.0",
            "commercial_use_permitted": True,
            "copyleft": False
        },
        "runtime_profile": {
            "tier": "T1",
            "engine": "vllm",
            "min_vram_gb": 48.0,
            "recommended_gpus": 2,
            "max_concurrent_requests": 16
        },
        "prompt_registry_digests": [
            {
                "prompt_id": "prompt-soc-triage-v1",
                "version": "1.2.0",
                "purpose": "triage",
                "digest": "sha256:3333333333333333333333333333333333333333333333333333333333333333"
            }
        ],
        # Missing evaluation_metrics
        "created_at": "2026-09-04T08:30:00Z",
        "digest": "sha256:8888888888888888888888888888888888888888888888888888888888888888"
    }
    with pytest.raises(ValidationError):
        aibom_validator.validate(payload)


def test_aibom_invalid_runtime_tier(aibom_validator: Draft202012Validator):
    """Verify runtime_profile.tier enum (T0, T1, T2)."""
    payload = {
        "bom_id": "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55",
        "spec_version": "1.0.0",
        "tenant_id": "tenant-sovereign-soc",
        "model_identity": {
            "model_id": "qwen2.5-72b-instruct-awq",
            "family": "Qwen",
            "name": "Qwen2.5-72B-Instruct-AWQ",
            "version": "2.5.0",
            "architecture": "transformer-decoder",
            "parameter_count_billions": 72.5,
            "quantization": "awq"
        },
        "weights_digest": {
            "algorithm": "sha256",
            "digest": "sha256:4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
            "file_count": 8,
            "total_size_bytes": 41280000000
        },
        "license": {
            "spdx_expression": "Apache-2.0",
            "commercial_use_permitted": True,
            "copyleft": False
        },
        "runtime_profile": {
            "tier": "T9",  # Invalid tier!
            "engine": "vllm",
            "min_vram_gb": 48.0,
            "recommended_gpus": 2,
            "max_concurrent_requests": 16
        },
        "prompt_registry_digests": [
            {
                "prompt_id": "prompt-soc-triage-v1",
                "version": "1.2.0",
                "purpose": "triage",
                "digest": "sha256:3333333333333333333333333333333333333333333333333333333333333333"
            }
        ],
        "evaluation_metrics": {
            "benchmark_suite": "CYBRIK-Golden-Eval-100",
            "golden_dataset_version": "2026.08-rev1",
            "accuracy_score": 0.942,
            "hallucination_rate": 0.015,
            "adversarial_robustness_score": 0.968,
            "evaluated_at": "2026-09-04T08:00:00Z"
        },
        "created_at": "2026-09-04T08:30:00Z",
        "digest": "sha256:8888888888888888888888888888888888888888888888888888888888888888"
    }
    with pytest.raises(ValidationError):
        aibom_validator.validate(payload)


# ==============================================================================
# PILLAR 5, 9, 10: EXECUTION RECEIPT LEDGER SCHEMA TESTS
# ==============================================================================

@pytest.fixture
def execution_receipt_ledger_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.execution-receipt-ledger.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


def test_execution_receipt_ledger_valid_sealed_block(execution_receipt_ledger_validator: Draft202012Validator):
    """Test valid sealed execution receipt ledger block with Merkle root and signatures."""
    payload = {
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
                "signature_value": "3J98t1Wp...signature...",
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
    execution_receipt_ledger_validator.validate(payload)


def test_execution_receipt_ledger_invalid_negative_sequence(execution_receipt_ledger_validator: Draft202012Validator):
    """Verify sequence_number minimum: 0 constraint."""
    payload = {
        "ledger_id": "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66",
        "tenant_id": "tenant-bank-security",
        "sequence_number": -1,  # Invalid negative sequence
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
                "receipt_digest": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
                "recorded_at": "2026-09-04T11:00:00Z"
            }
        ],
        "hashes": {
            "previous_ledger_digest": "sha256:5555555555555555555555555555555555555555555555555555555555555555",
            "merkle_root": "sha256:6666666666666666666666666666666666666666666666666666666666666666",
            "receipts_aggregate_hash": "sha256:7777777777777777777777777777777777777777777777777777777777777777"
        },
        "signatures": [
            {
                "authority_id": "spiffe://cybrik.internal/tool-fabric/control-plane-signer",
                "key_id": "key-fabric-cp-2026a",
                "algorithm": "Ed25519",
                "signature_value": "3J98t1Wp...signature...",
                "signed_at": "2026-09-04T11:10:00Z"
            }
        ],
        "started_at": "2026-09-04T11:00:00Z",
        "closed_at": "2026-09-04T11:10:00Z",
        "receipt_count": 1,
        "digest": "sha256:9999999999999999999999999999999999999999999999999999999999999999"
    }
    with pytest.raises(ValidationError):
        execution_receipt_ledger_validator.validate(payload)


def test_execution_receipt_ledger_invalid_missing_signatures(execution_receipt_ledger_validator: Draft202012Validator):
    """Verify signatures is required on sealed execution receipt ledger."""
    payload = {
        "ledger_id": "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66",
        "tenant_id": "tenant-bank-security",
        "sequence_number": 1,
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
                "receipt_digest": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
                "recorded_at": "2026-09-04T11:00:00Z"
            }
        ],
        "hashes": {
            "previous_ledger_digest": "sha256:5555555555555555555555555555555555555555555555555555555555555555",
            "merkle_root": "sha256:6666666666666666666666666666666666666666666666666666666666666666",
            "receipts_aggregate_hash": "sha256:7777777777777777777777777777777777777777777777777777777777777777"
        },
        "signatures": [],  # MinItems: 1 constraint
        "started_at": "2026-09-04T11:00:00Z",
        "closed_at": "2026-09-04T11:10:00Z",
        "receipt_count": 1,
        "digest": "sha256:9999999999999999999999999999999999999999999999999999999999999999"
    }
    with pytest.raises(ValidationError):
        execution_receipt_ledger_validator.validate(payload)
