"""Comprehensive test suite validating CYBRIK competitive JSON schemas v3 (Draft 2020-12).

Covers:
- cybrik.soar-playbook.v1.schema.json (Pillars 5, 8, 9, 10: SOAR Playbooks, DAG Dependencies, Risk Tiers R0-R3, Retries, Rollback Compensation)
- cybrik.merkle-audit-proof.v1.schema.json (Pillars 5, 9, 10: Binary Merkle Inclusion Proofs, 64-leaf Epoch Roots, Audit Paths, Ed25519 Notary Envelopes)
- cybrik.action-approval.v1.schema.json (Pillars 5, 8, 9, 10: Four-Eyes Approvals, Separation of Duties, Ephemeral Leases, Digital Signatures)
- Positive fixture conformance across all 3 contracts
- Adversarial & negative-schema test cases (invalid enums, missing fields, negative bounds, non-human approvers)
- Negative-semantic control plane invariant checks (cyclic DAGs, self-approval, cross-tenant actions, forged sibling hashes, signature forgery)
- Direct $defs subschema unit testing
- Full cryptographic & mathematical verification (SHA-256 Merkle tree verification, Ed25519 signature verification, RFC 8785 canonical digests)
- Conformance manifest integrity and fixture mapping
"""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
from typing import Any

import pytest
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import ed25519
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCHEMA_DIR = REPO_ROOT / "contracts" / "json-schema"
EXAMPLES_DIR = REPO_ROOT / "contracts" / "examples"

COMPETITIVE_SCHEMAS_V3 = [
    "cybrik.soar-playbook.v1.schema.json",
    "cybrik.merkle-audit-proof.v1.schema.json",
    "cybrik.action-approval.v1.schema.json",
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

@pytest.mark.parametrize("schema_file", COMPETITIVE_SCHEMAS_V3)
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
def soar_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.soar-playbook.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def merkle_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.merkle-audit-proof.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.fixture
def approval_validator(registry: Registry) -> Draft202012Validator:
    schema = load_schema("cybrik.action-approval.v1.schema.json")
    return Draft202012Validator(schema, registry=registry)


@pytest.mark.parametrize("example_file", [
    "soar/positive/soar-playbook.phishing-triage-rollback.json",
    "soar/positive/soar-playbook.ioc-quarantine-dag.json",
    "soar/positive/soar-playbook.credential-revocation.json",
])
def test_soar_positive_examples(soar_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(soar_validator.iter_errors(instance))
    assert not errors, f"SOAR positive example {example_file} failed validation: {[e.message for e in errors]}"


@pytest.mark.parametrize("example_file", [
    "merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json",
    "merkle/positive/merkle-proof.ledger-audit-trail.json",
])
def test_merkle_positive_examples(merkle_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(merkle_validator.iter_errors(instance))
    assert not errors, f"Merkle positive example {example_file} failed validation: {[e.message for e in errors]}"


@pytest.mark.parametrize("example_file", [
    "approval/positive/action-approval.containment-firewall-block.json",
    "approval/positive/action-approval.privileged-account-disable.json",
])
def test_approval_positive_examples(approval_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(approval_validator.iter_errors(instance))
    assert not errors, f"Approval positive example {example_file} failed validation: {[e.message for e in errors]}"


# ==============================================================================
# SECTION 3: ADVERSARIAL & IN-MEMORY SCHEMA EDGE CASES
# ==============================================================================

# --- SOAR ADVERSARIAL CASES ---

def test_soar_invalid_step_type(soar_validator: Draft202012Validator):
    """Adversarial case: Unauthorized step type rejected."""
    instance = load_example("soar/positive/soar-playbook.phishing-triage-rollback.json")
    instance["steps"][0]["step_type"] = "arbitrary_code_injection"
    with pytest.raises(ValidationError):
        soar_validator.validate(instance)


def test_soar_negative_retry_count(soar_validator: Draft202012Validator):
    """Adversarial case: Negative max_retries rejected."""
    instance = load_example("soar/positive/soar-playbook.phishing-triage-rollback.json")
    instance["steps"][0]["retry_policy"]["max_retries"] = -1
    with pytest.raises(ValidationError):
        soar_validator.validate(instance)


def test_soar_retry_count_exceeds_maximum(soar_validator: Draft202012Validator):
    """Adversarial case: max_retries > 10 rejected."""
    instance = load_example("soar/positive/soar-playbook.phishing-triage-rollback.json")
    instance["steps"][0]["retry_policy"]["max_retries"] = 50
    with pytest.raises(ValidationError):
        soar_validator.validate(instance)


def test_soar_negative_timeout(soar_validator: Draft202012Validator):
    """Adversarial case: Non-positive timeout_seconds rejected."""
    instance = load_example("soar/positive/soar-playbook.phishing-triage-rollback.json")
    instance["timeout_seconds"] = 0
    with pytest.raises(ValidationError):
        soar_validator.validate(instance)


def test_soar_invalid_dialect(soar_validator: Draft202012Validator):
    """Adversarial case: Unsupported condition dialect rejected."""
    instance = load_example("soar/positive/soar-playbook.phishing-triage-rollback.json")
    instance["steps"][1]["condition"]["dialect"] = "lua_script_eval"
    with pytest.raises(ValidationError):
        soar_validator.validate(instance)


@pytest.mark.parametrize("required_field", [
    "playbook_id",
    "name",
    "version",
    "tenant_id",
    "author",
    "risk_tier",
    "entry_step_id",
    "steps",
    "data_marking",
    "created_at",
    "digest",
])
def test_soar_missing_required_fields(soar_validator: Draft202012Validator, required_field: str):
    """Adversarial case: Dropping mandatory top-level SOAR fields."""
    instance = load_example("soar/positive/soar-playbook.phishing-triage-rollback.json")
    del instance[required_field]
    with pytest.raises(ValidationError):
        soar_validator.validate(instance)


# --- MERKLE ADVERSARIAL CASES ---

def test_merkle_negative_tree_size(merkle_validator: Draft202012Validator):
    """Adversarial case: Non-positive tree_size rejected."""
    instance = load_example("merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json")
    instance["tree_size"] = 0
    with pytest.raises(ValidationError):
        merkle_validator.validate(instance)


def test_merkle_invalid_position_enum(merkle_validator: Draft202012Validator):
    """Adversarial case: Invalid audit path sibling position enum."""
    instance = load_example("merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json")
    instance["audit_path"][0]["position"] = "middle_sibling"
    with pytest.raises(ValidationError):
        merkle_validator.validate(instance)


def test_merkle_empty_audit_path(merkle_validator: Draft202012Validator):
    """Adversarial case: Empty audit path array (minItems 1 constraint)."""
    instance = load_example("merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json")
    instance["audit_path"] = []
    with pytest.raises(ValidationError):
        merkle_validator.validate(instance)


def test_merkle_malformed_public_key_hex(merkle_validator: Draft202012Validator):
    """Adversarial case: Malformed public_key_hex (not 64 hex chars)."""
    instance = load_example("merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json")
    instance["signature_envelope"]["public_key_hex"] = "abcdef"
    with pytest.raises(ValidationError):
        merkle_validator.validate(instance)


def test_merkle_malformed_signature_hex(merkle_validator: Draft202012Validator):
    """Adversarial case: Malformed signature_hex (not 128 hex chars)."""
    instance = load_example("merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json")
    instance["signature_envelope"]["signature_hex"] = "00112233"
    with pytest.raises(ValidationError):
        merkle_validator.validate(instance)


@pytest.mark.parametrize("required_field", [
    "proof_id",
    "epoch_id",
    "tenant_id",
    "tree_size",
    "leaf_index",
    "leaf_digest",
    "epoch_root",
    "hash_algorithm",
    "audit_path",
    "signature_envelope",
    "data_marking",
    "created_at",
    "digest",
])
def test_merkle_missing_required_fields(merkle_validator: Draft202012Validator, required_field: str):
    """Adversarial case: Dropping mandatory top-level Merkle proof fields."""
    instance = load_example("merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json")
    del instance[required_field]
    with pytest.raises(ValidationError):
        merkle_validator.validate(instance)


# --- APPROVAL ADVERSARIAL CASES ---

def test_approval_non_human_approver(approval_validator: Draft202012Validator):
    """Adversarial case: Non-human (agent/service) approver rejected by schema."""
    instance = load_example("approval/positive/action-approval.containment-firewall-block.json")
    instance["decision_record"]["approver"]["type"] = "agent"
    with pytest.raises(ValidationError):
        approval_validator.validate(instance)

    instance["decision_record"]["approver"]["type"] = "service"
    with pytest.raises(ValidationError):
        approval_validator.validate(instance)


def test_approval_negative_lease_ttl(approval_validator: Draft202012Validator):
    """Adversarial case: Negative or zero TTL rejected."""
    instance = load_example("approval/positive/action-approval.containment-firewall-block.json")
    instance["ephemeral_lease"]["ttl_seconds"] = 0
    with pytest.raises(ValidationError):
        approval_validator.validate(instance)

    instance["ephemeral_lease"]["ttl_seconds"] = -60
    with pytest.raises(ValidationError):
        approval_validator.validate(instance)


def test_approval_invalid_decision_status(approval_validator: Draft202012Validator):
    """Adversarial case: Invalid decision status string."""
    instance = load_example("approval/positive/action-approval.containment-firewall-block.json")
    instance["decision_record"]["status"] = "tentatively_maybe"
    with pytest.raises(ValidationError):
        approval_validator.validate(instance)


def test_approval_missing_approver_tenant(approval_validator: Draft202012Validator):
    """Adversarial case: Human approver missing mandatory tenant_id."""
    instance = load_example("approval/positive/action-approval.containment-firewall-block.json")
    del instance["decision_record"]["approver"]["tenant_id"]
    with pytest.raises(ValidationError):
        approval_validator.validate(instance)


@pytest.mark.parametrize("required_field", [
    "approval_id",
    "tenant_id",
    "action_request",
    "approval_policy",
    "decision_record",
    "ephemeral_lease",
    "data_marking",
    "created_at",
    "digest",
])
def test_approval_missing_required_fields(approval_validator: Draft202012Validator, required_field: str):
    """Adversarial case: Dropping mandatory top-level Action Approval fields."""
    instance = load_example("approval/positive/action-approval.containment-firewall-block.json")
    del instance[required_field]
    with pytest.raises(ValidationError):
        approval_validator.validate(instance)


# ==============================================================================
# SECTION 4: NEGATIVE FIXTURE FILES CONFORMANCE
# ==============================================================================

@pytest.mark.parametrize("example_file", [
    "soar/negative-schema/soar-invalid-step-type.json",
    "soar/negative-schema/soar-missing-entry-step.json",
    "soar/negative-schema/soar-negative-retry-count.json",
    "soar/negative-schema/soar-missing-required-fields.json",
    "soar/negative-schema/soar-invalid-risk-tier.json",
])
def test_soar_negative_schema_files(soar_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(soar_validator.iter_errors(instance))
    assert len(errors) > 0, f"Expected {example_file} to fail schema validation, but it passed!"


@pytest.mark.parametrize("example_file", [
    "merkle/negative-schema/merkle-malformed-audit-path.json",
    "merkle/negative-schema/merkle-invalid-hash-length.json",
    "merkle/negative-schema/merkle-negative-tree-size.json",
    "merkle/negative-schema/merkle-missing-required-fields.json",
])
def test_merkle_negative_schema_files(merkle_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(merkle_validator.iter_errors(instance))
    assert len(errors) > 0, f"Expected {example_file} to fail schema validation, but it passed!"


@pytest.mark.parametrize("example_file", [
    "approval/negative-schema/approval-missing-decision-status.json",
    "approval/negative-schema/approval-malformed-ttl.json",
    "approval/negative-schema/approval-non-human-approver.json",
    "approval/negative-schema/approval-missing-required-fields.json",
])
def test_approval_negative_schema_files(approval_validator: Draft202012Validator, example_file: str):
    instance = load_example(example_file)
    errors = list(approval_validator.iter_errors(instance))
    assert len(errors) > 0, f"Expected {example_file} to fail schema validation, but it passed!"


# ==============================================================================
# SECTION 5: NEGATIVE SEMANTIC & CONTROL PLANE INVARIANT CHECKS
# ==============================================================================

def detect_dag_cycle(steps: list[dict[str, Any]]) -> bool:
    """Helper to detect directed cycles in a step dependency list."""
    adj: dict[str, list[str]] = {s["step_id"]: list(s.get("depends_on", [])) for s in steps}
    visited: dict[str, int] = {}  # 0: unvisited, 1: visiting, 2: visited

    def dfs(node: str) -> bool:
        visited[node] = 1
        for neighbor in adj.get(node, []):
            if visited.get(neighbor, 0) == 1:
                return True
            if visited.get(neighbor, 0) == 0 and dfs(neighbor):
                return True
        visited[node] = 2
        return False

    for node in adj:
        if visited.get(node, 0) == 0:
            if dfs(node):
                return True
    return False


def test_soar_negative_semantic_cyclic_dependency(soar_validator: Draft202012Validator):
    """Verify negative semantic cyclic dependency fixture passes schema but fails DAG cycle check."""
    instance = load_example("soar/negative-semantic/soar-cyclic-dependency.json")
    soar_validator.validate(instance)  # structurally valid
    assert detect_dag_cycle(instance["steps"]) is True, "Expected DAG cycle detection to trigger on cyclic fixture"


def test_soar_negative_semantic_cross_tenant_action(soar_validator: Draft202012Validator):
    """Verify negative semantic cross-tenant action passes schema but violates tenant boundaries."""
    instance = load_example("soar/negative-semantic/soar-cross-tenant-action.json")
    soar_validator.validate(instance)  # structurally valid
    playbook_tenant = instance["tenant_id"]
    step_target_tenants = [
        s["action"]["target_tenant_id"]
        for s in instance["steps"]
        if "action" in s and "target_tenant_id" in s["action"]
    ]
    assert any(t != playbook_tenant for t in step_target_tenants), "Expected cross-tenant action mismatch"


def test_merkle_negative_semantic_mismatched_leaf_index(merkle_validator: Draft202012Validator):
    """Verify negative semantic mismatched leaf index passes schema but fails Merkle path verification."""
    instance = load_example("merkle/negative-semantic/merkle-mismatched-leaf-index.json")
    merkle_validator.validate(instance)  # structurally valid

    # Recompute Merkle root using declared audit path
    curr = instance["leaf_digest"]
    for node in instance["audit_path"]:
        curr_b = bytes.fromhex(curr.replace("sha256:", ""))
        sib_b = bytes.fromhex(node["hash"].replace("sha256:", ""))
        if node["position"] == "right":
            combined = curr_b + sib_b
        else:
            combined = sib_b + curr_b
        curr = f"sha256:{hashlib.sha256(combined).hexdigest()}"

    assert curr != instance["epoch_root"], "Expected Merkle proof recomputation to mismatch epoch_root"


def test_merkle_negative_semantic_forged_sibling_hash(merkle_validator: Draft202012Validator):
    """Verify negative semantic forged sibling hash passes schema but fails Merkle path verification."""
    instance = load_example("merkle/negative-semantic/merkle-forged-sibling-hash.json")
    merkle_validator.validate(instance)  # structurally valid

    curr = instance["leaf_digest"]
    for node in instance["audit_path"]:
        curr_b = bytes.fromhex(curr.replace("sha256:", ""))
        sib_b = bytes.fromhex(node["hash"].replace("sha256:", ""))
        if node["position"] == "right":
            combined = curr_b + sib_b
        else:
            combined = sib_b + curr_b
        curr = f"sha256:{hashlib.sha256(combined).hexdigest()}"

    assert curr != instance["epoch_root"], "Expected forged sibling hash to invalidate Merkle root convergence"


def test_merkle_negative_semantic_invalid_signature(merkle_validator: Draft202012Validator):
    """Verify negative semantic invalid signature passes schema but fails Ed25519 verification."""
    instance = load_example("merkle/negative-semantic/merkle-invalid-ed25519-signature.json")
    merkle_validator.validate(instance)  # structurally valid

    pub_bytes = bytes.fromhex(instance["signature_envelope"]["public_key_hex"])
    sig_bytes = bytes.fromhex(instance["signature_envelope"]["signature_hex"])
    public_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
    data_to_verify = instance["epoch_root"].encode("utf-8")

    with pytest.raises(InvalidSignature):
        public_key.verify(sig_bytes, data_to_verify)


def test_approval_negative_semantic_self_approval(approval_validator: Draft202012Validator):
    """Verify self-approval fixture passes schema but violates separation-of-duties invariant."""
    instance = load_example("approval/negative-semantic/approval-self-approval-violation.json")
    approval_validator.validate(instance)  # structurally valid
    requester_id = instance["action_request"]["requested_by"]["id"]
    approver_id = instance["decision_record"]["approver"]["id"]
    assert requester_id == approver_id, "Expected self-approval violation condition"


def test_approval_negative_semantic_expired_lease(approval_validator: Draft202012Validator):
    """Verify expired lease fixture passes schema but violates temporal lease bounds."""
    instance = load_example("approval/negative-semantic/approval-expired-ephemeral-lease.json")
    approval_validator.validate(instance)  # structurally valid
    decided_at = instance["decision_record"]["decided_at"]
    valid_until = instance["ephemeral_lease"]["valid_until"]
    assert valid_until < decided_at, "Expected ephemeral lease to be expired relative to decided_at"


def test_approval_negative_semantic_cross_tenant_approver(approval_validator: Draft202012Validator):
    """Verify cross-tenant approver fixture passes schema but violates tenant isolation."""
    instance = load_example("approval/negative-semantic/approval-cross-tenant-approver.json")
    approval_validator.validate(instance)  # structurally valid
    assert instance["tenant_id"] != instance["decision_record"]["approver"]["tenant_id"]


# ==============================================================================
# SECTION 6: SUBSCHEMA & DEFINITIONS VALIDATION
# ==============================================================================

def get_subschema_validator(schema_name: str, def_name: str, registry: Registry) -> Draft202012Validator:
    """Create a validator targeting a specific $defs sub-schema within a file."""
    return Draft202012Validator(
        {"$ref": f"{schema_name}#/$defs/{def_name}"},
        registry=registry,
    )


def test_soar_rollback_policy_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.soar-playbook.v1.schema.json", "rollbackPolicy", registry)
    valid_policy = {
        "mode": "on_failure",
        "timeout_seconds": 180,
        "max_rollback_steps": 5,
    }
    validator.validate(valid_policy)

    # Invalid mode
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_policy)
        bad["mode"] = "invalid_mode_unknown"
        validator.validate(bad)

    # Missing mode
    with pytest.raises(ValidationError):
        validator.validate({"timeout_seconds": 180})


def test_soar_retry_policy_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.soar-playbook.v1.schema.json", "retryPolicy", registry)
    valid_retry = {
        "max_retries": 3,
        "initial_backoff_seconds": 1.0,
        "backoff_multiplier": 2.0,
        "max_backoff_seconds": 60.0,
        "retryable_errors": ["ConnectionReset", "Timeout"],
    }
    validator.validate(valid_retry)

    # Negative retries
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_retry)
        bad["max_retries"] = -1
        validator.validate(bad)

    # Backoff multiplier < 1.0
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_retry)
        bad["backoff_multiplier"] = 0.5
        validator.validate(bad)


def test_soar_step_condition_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.soar-playbook.v1.schema.json", "stepCondition", registry)
    valid_cond = {
        "expression": "threat.severity == 'HIGH'",
        "dialect": "cel",
        "on_true_step_id": "step-isolate",
        "on_false_step_id": "step-log",
    }
    validator.validate(valid_cond)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_cond)
        bad["dialect"] = "unsupported_dialect"
        validator.validate(bad)


def test_merkle_audit_node_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.merkle-audit-proof.v1.schema.json", "auditPathNode", registry)
    valid_node = {
        "position": "left",
        "hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "level": 0,
    }
    validator.validate(valid_node)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_node)
        bad["position"] = "top"
        validator.validate(bad)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_node)
        bad["hash"] = "not-a-sha256"
        validator.validate(bad)


def test_merkle_ed25519_envelope_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.merkle-audit-proof.v1.schema.json", "ed25519SignatureEnvelope", registry)
    valid_env = {
        "algorithm": "Ed25519",
        "key_id": "key-notary-01",
        "public_key_hex": "399793721ae29e90c829a4e3586d0a2d941362a6ce0ca533308a20506c7b60bb",
        "signature_hex": "321c1347d1f6ebb8fc006078019a9a0c0aa489b3906cf048337147824cdd6c2ac08dd8f520232d059b279f997170ba714f029e77c325cf049681bdf97e134c0b",
        "signed_at": "2026-09-05T02:00:00Z",
        "signer_identity": "urn:cybrik:ledger:notary",
    }
    validator.validate(valid_env)

    # Wrong algorithm
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_env)
        bad["algorithm"] = "RSA_2048"
        validator.validate(bad)

    # Malformed key hex
    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_env)
        bad["public_key_hex"] = "short_key"
        validator.validate(bad)


def test_approval_ephemeral_lease_subschema(registry: Registry):
    validator = get_subschema_validator("cybrik.action-approval.v1.schema.json", "ephemeralLease", registry)
    valid_lease = {
        "lease_id": "lease_emergency_block_01",
        "valid_from": "2026-09-05T02:00:00Z",
        "valid_until": "2026-09-05T03:00:00Z",
        "ttl_seconds": 3600,
        "max_invocations": 1,
        "lease_status": "active",
        "remaining_invocations": 1,
    }
    validator.validate(valid_lease)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_lease)
        bad["ttl_seconds"] = 0
        validator.validate(bad)

    with pytest.raises(ValidationError):
        bad = copy.deepcopy(valid_lease)
        bad["lease_status"] = "in_limbo"
        validator.validate(bad)


# ==============================================================================
# SECTION 7: CRYPTOGRAPHIC & MATHEMATICAL VERIFICATION
# ==============================================================================

def test_merkle_inclusion_proof_mathematical_verification():
    """Verify mathematical Merkle path recomputation from leaf 42 up to epoch root."""
    proof = load_example("merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json")
    curr = proof["leaf_digest"]
    for node in proof["audit_path"]:
        curr_bytes = bytes.fromhex(curr.replace("sha256:", ""))
        sib_bytes = bytes.fromhex(node["hash"].replace("sha256:", ""))
        if node["position"] == "right":
            combined = curr_bytes + sib_bytes
        else:
            combined = sib_bytes + curr_bytes
        curr = f"sha256:{hashlib.sha256(combined).hexdigest()}"

    assert curr == proof["epoch_root"], "Mathematical Merkle tree path recomputation did not match epoch_root"


def test_merkle_ed25519_signature_verification():
    """Verify Ed25519 signature over epoch root using sovereign notary public key."""
    proof = load_example("merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json")
    envelope = proof["signature_envelope"]

    pub_bytes = bytes.fromhex(envelope["public_key_hex"])
    sig_bytes = bytes.fromhex(envelope["signature_hex"])
    public_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
    data_to_verify = proof["epoch_root"].encode("utf-8")

    # Should not raise
    public_key.verify(sig_bytes, data_to_verify)


def test_approval_ed25519_signature_verification():
    """Verify Ed25519 signature over decision statement using approver public key."""
    appr = load_example("approval/positive/action-approval.containment-firewall-block.json")
    sig_obj = appr["decision_record"]["signature"]

    pub_bytes = bytes.fromhex(sig_obj["public_key_hex"])
    sig_bytes = bytes.fromhex(sig_obj["signature_hex"])
    public_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)

    decision_stmt = {
        "approval_id": appr["approval_id"],
        "decision": appr["decision_record"]["status"],
        "approver": appr["decision_record"]["approver"]["id"],
        "decided_at": appr["decision_record"]["decided_at"],
    }
    data_to_verify = json.dumps(decision_stmt, sort_keys=True, separators=(",", ":")).encode("utf-8")
    public_key.verify(sig_bytes, data_to_verify)


@pytest.mark.parametrize("fixture_path", [
    "soar/positive/soar-playbook.phishing-triage-rollback.json",
    "soar/positive/soar-playbook.ioc-quarantine-dag.json",
    "soar/positive/soar-playbook.credential-revocation.json",
    "merkle/positive/merkle-proof.64-leaf-epoch-inclusion.json",
    "merkle/positive/merkle-proof.ledger-audit-trail.json",
    "approval/positive/action-approval.containment-firewall-block.json",
    "approval/positive/action-approval.privileged-account-disable.json",
])
def test_canonical_digest_integrity(fixture_path: str):
    """Verify canonical JSON SHA-256 digest integrity across all positive fixtures."""
    doc = load_example(fixture_path)
    expected_digest = doc["digest"]
    recomputed = canonical_json_sha256(doc)
    assert recomputed == expected_digest, f"Digest mismatch in {fixture_path}: expected {expected_digest}, got {recomputed}"


# ==============================================================================
# SECTION 8: CONFORMANCE MANIFEST INTEGRITY
# ==============================================================================

@pytest.mark.parametrize("manifest_rel_path", [
    "soar/examples-manifest.json",
    "merkle/examples-manifest.json",
    "approval/examples-manifest.json",
])
def test_conformance_manifest_integrity(manifest_rel_path: str):
    """Verify conformance manifest structure, accepted status, and fixture file existence."""
    manifest = load_example(manifest_rel_path)
    assert manifest["status"] == "ACCEPTED FOR IMPLEMENTATION"
    assert manifest["not_accepted"] is False
    assert manifest["contract_version"] == "1.0.0"
    assert len(manifest["fixtures"]) >= 5

    parent_dir = Path(manifest_rel_path).parent
    for fixture_entry in manifest["fixtures"]:
        fixture_file = EXAMPLES_DIR / parent_dir / fixture_entry["file"]
        assert fixture_file.exists(), f"Fixture file referenced in manifest does not exist: {fixture_file}"
        assert fixture_entry["kind"] in ("positive", "negative-schema", "negative-semantic")
        assert fixture_entry["schema"] in COMPETITIVE_SCHEMAS_V3
