"""Semantic bindings, signature and one-attempt state form one fail-closed gate."""

from __future__ import annotations

import json
from hashlib import sha256

import pytest

import fakes
import documents
from conftest import load_c8, require_c8_attr


@pytest.fixture(name="admission")
def admission_module():
    return load_c8("admission")


def decide(admission, adapters=None, authorization=None, execute_requested=True):
    return require_c8_attr(admission, "decide")(
        authorization or documents.authorization(),
        adapters or fakes.passing_adapters(),
        execute_requested=execute_requested,
    )


def record_with_attempt(**patch):
    record = documents.synthetic_authorized_record()
    return {**record, "attempt": {**record["attempt"], **patch}}


def record_with_authorization(**patch):
    record = documents.synthetic_authorized_record()
    return {**record, "authorization": {**record["authorization"], **patch}}


def test_synthetic_authorized_fixture_matches_the_committed_record_shape(admission) -> None:
    record = documents.synthetic_authorized_record()
    assert require_c8_attr(admission, "validate_record_shape")(record).satisfied
    assert set(record) == {
        "schema_version",
        "record_id",
        "recorded_at",
        "identity",
        "attempt",
        "topology",
        "production_exclusion",
        "authorization",
        "evidence",
        "disposition",
    }
    assert "record_sha256" not in record
    assert record["attempt"]["phase"] == fakes.PHASE_AUTHORIZED
    assert record["attempt"]["outcome"] == fakes.OUTCOME_NOT_RUN


def test_synthetic_authorization_binds_the_exact_artifact_paths_digests_and_bytes(
    admission,
) -> None:
    record = documents.synthetic_authorized_record()
    authorization = documents.authorization(record=record)
    artifacts = {
        artifact["kind"]: artifact for artifact in record["evidence"]["artifacts"]
    }
    grant_artifact = artifacts["grant"]
    signature_artifact = artifacts["authorization_signature"]
    record_authorization = record["authorization"]
    assert record_authorization["grant_path"] == grant_artifact["path"]
    assert record_authorization["grant_sha256"] == grant_artifact["sha256"]
    assert record_authorization["grant_sha256"] == sha256(
        authorization.grant_bytes
    ).hexdigest()
    assert record_authorization["signature_path"] == signature_artifact["path"]
    assert record_authorization["signature_sha256"] == signature_artifact["sha256"]
    assert record_authorization["signature_sha256"] == sha256(
        authorization.signature_bytes
    ).hexdigest()
    assert require_c8_attr(admission, "validate_record_shape")(record).satisfied


def test_grant_binds_the_exact_pinned_proposed_record_identity(admission) -> None:
    """The grant binds the prior proposed bytes, not an impossible self-hash.

    The authorized record contains the grant artifact and therefore cannot hash to the digest
    inside that same grant. Its record-review binding carries the exact proposed prior-state
    digest; the loader supplies the same path/digest to semantic admission.
    """
    authorization = documents.authorization()
    assert authorization.grant["record"] == {
        "path": authorization.record_path,
        "sha256": authorization.record_sha256,
    }
    assert (
        authorization.record["evidence"]["record_review_binding"][
            "reviewed_record_sha256"
        ]
        == authorization.record_sha256
    )
    adapters = fakes.passing_adapters()
    assert decide(admission, adapters, authorization).admitted is True


@pytest.mark.parametrize(
    "authorization_patch",
    [
        {"record_path": "docs/uat/wrong-proposed-record.json"},
        {"record_sha256": "0" * 64},
    ],
)
def test_loader_prior_record_identity_drift_refuses_before_signature(
    admission, authorization_patch
) -> None:
    authorization = documents.authorization(**authorization_patch)
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, authorization)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


def test_record_review_prior_digest_drift_refuses_before_signature(admission) -> None:
    record = documents.synthetic_authorized_record()
    binding = {
        **record["evidence"]["record_review_binding"],
        "reviewed_record_sha256": "0" * 64,
    }
    record = {
        **record,
        "evidence": {**record["evidence"], "record_review_binding": binding},
    }
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, documents.authorization(record=record))
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


def test_record_review_phase_drift_refuses_before_signature(admission) -> None:
    record = documents.synthetic_authorized_record()
    binding = {
        **record["evidence"]["record_review_binding"],
        "reviewed_phase": "authorized",
    }
    record = {
        **record,
        "evidence": {**record["evidence"], "record_review_binding": binding},
    }
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, documents.authorization(record=record))
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


def test_the_record_image_is_a_resolution_stated_observation_of_the_selection(
    admission,
) -> None:
    """`topology.image` is derived from the selection, and is never the same object."""
    selected = documents.grant_document()["selected_image_identity"]
    image = documents.synthetic_authorized_record()["topology"]["image"]
    assert set(selected) == set(documents.SELECTED_IDENTITY_KEYS)
    assert "resolution_state" not in selected
    assert set(image) == {"resolution_state", *documents.SELECTED_IDENTITY_KEYS}
    assert image != selected
    assert image["resolution_state"] == fakes.IMAGE_RESOLVED
    assert {key: image[key] for key in documents.SELECTED_IDENTITY_KEYS} == selected
    assert "local_image_id" not in image
    assert require_c8_attr(admission, "validate_record_shape")(
        documents.synthetic_authorized_record()
    ).satisfied


@pytest.mark.parametrize(
    "image",
    [
        documents.grant_document()["selected_image_identity"],
        documents.selected_image_observation(resolution_state=fakes.IMAGE_UNRESOLVED),
        documents.with_fields(
            documents.selected_image_observation(),
            {"local_image_id": fakes.SYNTHETIC_HOST_IMAGE_ID},
        ),
        documents.without_field(documents.selected_image_observation(), "index_digest"),
    ],
)
def test_a_record_image_that_is_not_a_resolved_selected_observation_fails_shape(
    admission, image
) -> None:
    """A bare grant object, an unresolved selection and a host identity all fail closed."""
    record = documents.synthetic_authorized_record()
    malformed = {**record, "topology": {**record["topology"], "image": image}}
    assert not require_c8_attr(admission, "validate_record_shape")(malformed).satisfied


def test_default_without_exact_execute_request_is_hold_and_never_verifies(admission) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, execute_requested=False)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.entries == ()


def test_exact_semantics_are_checked_before_the_detached_signature(admission) -> None:
    malformed = documents.grant_document(record={"path": "wrong", "sha256": "0" * 64})
    auth = documents.authorization(grant=malformed, grant_bytes=documents.canonical_bytes(malformed))
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, auth)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert "verifier.verify" not in adapters.log.names()


def test_valid_semantics_and_signature_admit_but_do_not_consume(admission) -> None:
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters)
    assert verdict.admitted is True
    assert adapters.log.count("verifier.verify") == 1
    assert adapters.log.count("ledger.is_consumed") == 1
    assert adapters.log.count("ledger.consume") == 0


def test_the_verifier_receives_the_canonical_grant_bytes_signer_and_namespace(
    admission,
) -> None:
    """The verified bytes are the canonical rendering of the very document that bound."""
    auth = documents.authorization()
    adapters = fakes.passing_adapters()
    assert decide(admission, adapters, auth).admitted is True
    call = adapters.log.calls("verifier.verify")[0]
    canonical = require_c8_attr(load_c8("grant"), "canonical_grant_bytes")(auth.grant)
    assert call["grant_bytes"] == canonical
    assert call["grant_bytes"] == auth.grant_bytes
    assert call["signature_bytes"] == auth.signature_bytes
    assert call["signer"] == fakes.SIGNER
    assert call["namespace"] == fakes.AUTHORIZATION_NAMESPACE


@pytest.mark.parametrize(
    "substituted",
    [
        # Canonical bytes of a *different* grant document.
        documents.canonical_bytes(documents.grant_document(authorizes="something_else")),
        # The same document rendered in a non-canonical encoding.
        json.dumps(documents.grant_document(), separators=(",", ":")).encode("utf-8"),
        documents.canonical_bytes(documents.grant_document())[:-1],
    ],
)
def test_grant_bytes_that_do_not_canonicalize_the_grant_refuse_before_verification(
    admission, substituted: bytes
) -> None:
    auth = documents.authorization(grant_bytes=substituted)
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, auth)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


def test_digest_consistent_but_noncanonical_grant_bytes_still_refuse(admission) -> None:
    substituted = json.dumps(documents.grant_document(), separators=(",", ":")).encode(
        "utf-8"
    )
    substituted_sha256 = sha256(substituted).hexdigest()
    record = record_with_authorization(grant_sha256=substituted_sha256)
    artifacts = [
        {**artifact, "sha256": substituted_sha256}
        if artifact["kind"] == "grant"
        else artifact
        for artifact in record["evidence"]["artifacts"]
    ]
    record = {**record, "evidence": {**record["evidence"], "artifacts": artifacts}}
    authorization = documents.authorization(record=record, grant_bytes=substituted)
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, authorization)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


@pytest.mark.parametrize(
    ("field", "bad"),
    [
        ("signer", "IMPOSTOR"),
        ("signer", fakes.SIGNER.lower()),
        ("namespace", "cybrik-uat-topology-rehearsal-v2"),
        ("namespace", ""),
    ],
)
def test_a_signer_or_namespace_other_than_the_exact_constant_refuses(
    admission, field: str, bad: str
) -> None:
    auth = documents.authorization(record=record_with_authorization(**{field: bad}))
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, auth)
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


@pytest.mark.parametrize(
    ("record_patch", "artifact_kind", "artifact_patch"),
    [
        ({"grant_path": "docs/uat/wrong-grant.json"}, None, None),
        ({"grant_sha256": "0" * 64}, None, None),
        ({"signature_path": "docs/uat/wrong-grant.sig"}, None, None),
        ({"signature_sha256": "0" * 64}, None, None),
        ({}, "grant", {"path": "docs/uat/other-grant.json"}),
        ({}, "grant", {"sha256": "1" * 64}),
        ({}, "authorization_signature", {"path": "docs/uat/other-grant.sig"}),
        ({}, "authorization_signature", {"sha256": "2" * 64}),
    ],
)
def test_record_artifact_and_authorization_binding_drift_refuses_before_signature(
    admission, record_patch, artifact_kind, artifact_patch
) -> None:
    record = record_with_authorization(**record_patch)
    if artifact_kind is not None:
        artifacts = [
            {**artifact, **artifact_patch}
            if artifact["kind"] == artifact_kind
            else artifact
            for artifact in record["evidence"]["artifacts"]
        ]
        record = {**record, "evidence": {**record["evidence"], "artifacts": artifacts}}
    adapters = fakes.passing_adapters()
    verdict = decide(
        admission,
        adapters,
        documents.authorization(record=record),
    )
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


@pytest.mark.parametrize(
    ("kind", "duplicate"),
    [
        ("grant", False),
        ("grant", True),
        ("authorization_signature", False),
        ("authorization_signature", True),
    ],
)
def test_missing_or_duplicate_authorization_artifact_refuses_before_signature(
    admission, kind: str, duplicate: bool
) -> None:
    record = documents.synthetic_authorized_record()
    artifacts = list(record["evidence"]["artifacts"])
    target = next(artifact for artifact in artifacts if artifact["kind"] == kind)
    artifacts = artifacts + [dict(target)] if duplicate else [
        artifact for artifact in artifacts if artifact["kind"] != kind
    ]
    record = {**record, "evidence": {**record["evidence"], "artifacts": artifacts}}
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, documents.authorization(record=record))
    assert verdict.admitted is False
    assert verdict.outcome == fakes.PRECHECK_ABORT
    assert adapters.log.count("verifier.verify") == 0


@pytest.mark.parametrize(
    "record_patch",
    [
        {"phase": "proposed"},
        {"execution_authorized": False},
        {"attempt_consumed": True},
        {"attempt_ordinal": 2},
        {"max_attempts": 2},
        {"outcome": fakes.TOPOLOGY_PASS},
    ],
)
def test_record_state_drift_refuses_before_any_mutation(admission, record_patch) -> None:
    auth = documents.authorization(record=record_with_attempt(**record_patch))
    adapters = fakes.passing_adapters()
    verdict = decide(admission, adapters, auth)
    assert not verdict.admitted
    assert adapters.log.count("ledger.consume") == 0


@pytest.mark.parametrize("signature_verdict", (False, None))
def test_absent_or_invalid_signature_refuses(admission, signature_verdict) -> None:
    adapters = fakes.passing_adapters(verdict=signature_verdict)
    verdict = decide(admission, adapters)
    assert not verdict.admitted
    assert verdict.outcome == fakes.PRECHECK_ABORT


def test_an_already_consumed_attempt_refuses(admission) -> None:
    adapters = fakes.passing_adapters(consumed=(fakes.RECORD_ID,))
    verdict = decide(admission, adapters)
    assert not verdict.admitted
    assert adapters.log.count("ledger.consume") == 0


def test_admission_exports_only_decision_and_gate(admission) -> None:
    assert set(require_c8_attr(admission, "__all__")) == {
        "AdmissionDecision",
        "RecordShapeVerdict",
        "decide",
        "validate_record_shape",
    }
